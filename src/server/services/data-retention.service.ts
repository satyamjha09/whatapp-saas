import {
  DataRetentionAction,
  DataRetentionEntityType,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createIncident } from "@/server/services/incident.service";
import { logger } from "@/server/utils/safe-logger";

type RetentionResult = {
  checkedCount: number;
  deletedCount: number;
  skippedCount: number;
};

function isEnabled() {
  return process.env.DATA_RETENTION_ENABLED !== "false";
}

function isDryRun() {
  return process.env.DATA_RETENTION_DRY_RUN !== "false";
}

function shouldCreateIncidents() {
  return process.env.DATA_RETENTION_AUTO_INCIDENTS !== "false";
}

function numberFromEnv(key: string, fallback: number) {
  const parsed = Number(process.env[key] ?? fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function cutoffFromRetentionDays(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export async function seedDefaultDataRetentionPolicies() {
  const defaults: Array<{
    entityType: DataRetentionEntityType;
    retentionDays: number;
    action: DataRetentionAction;
    description: string;
  }> = [
    {
      entityType: "MESSAGE_EVENT",
      retentionDays: numberFromEnv("DATA_RETENTION_DEFAULT_MESSAGE_EVENT_DAYS", 365),
      action: "DELETE",
      description: "Removes old message lifecycle event logs.",
    },
    {
      entityType: "PROVIDER_WEBHOOK_EVENT",
      retentionDays: numberFromEnv("DATA_RETENTION_DEFAULT_PROVIDER_WEBHOOK_DAYS", 180),
      action: "DELETE",
      description: "Removes old provider webhook processing records.",
    },
    {
      entityType: "SECURITY_EVENT",
      retentionDays: numberFromEnv("DATA_RETENTION_DEFAULT_SECURITY_EVENT_DAYS", 365),
      action: "DELETE",
      description: "Removes old resolved security event records.",
    },
    {
      entityType: "STATUS_PAGE_EMAIL_DELIVERY",
      retentionDays: numberFromEnv(
        "DATA_RETENTION_DEFAULT_STATUS_EMAIL_DELIVERY_DAYS",
        180,
      ),
      action: "DELETE",
      description: "Removes old resolved notification email delivery logs.",
    },
    {
      entityType: "PUBLIC_PRIVACY_VERIFICATION",
      retentionDays: numberFromEnv(
        "DATA_RETENTION_DEFAULT_PUBLIC_PRIVACY_VERIFICATION_DAYS",
        90,
      ),
      action: "DELETE",
      description: "Removes old public privacy verification attempts.",
    },
  ];

  const results = [];

  for (const policy of defaults) {
    const existing = await prisma.dataRetentionPolicy.findFirst({
      where: {
        companyId: null,
        entityType: policy.entityType,
      },
    });

    const saved = existing
      ? await prisma.dataRetentionPolicy.update({
          where: {
            id: existing.id,
          },
          data: {
            retentionDays: policy.retentionDays,
            action: policy.action,
            description: policy.description,
            status: "ACTIVE",
          },
        })
      : await prisma.dataRetentionPolicy.create({
          data: {
            companyId: null,
            ...policy,
            status: "ACTIVE",
          },
        });

    results.push(saved);
  }

  return results;
}

async function getActiveLegalHoldEntityIds({
  entityType,
}: {
  entityType: "CONTACT" | "COMPANY" | "MESSAGE" | "PRIVACY_REQUEST" | "INCIDENT";
}) {
  const holds = await prisma.legalHold.findMany({
    where: {
      entityType,
      active: true,
    },
    select: {
      entityId: true,
    },
  });

  return new Set(holds.map((hold) => hold.entityId));
}

async function applyMessageEventRetention({
  cutoffAt,
  dryRun,
}: {
  cutoffAt: Date;
  dryRun: boolean;
}): Promise<RetentionResult> {
  const messageHoldIds = await getActiveLegalHoldEntityIds({
    entityType: "MESSAGE",
  });
  const candidates = await prisma.messageEvent.findMany({
    where: {
      createdAt: {
        lt: cutoffAt,
      },
    },
    select: {
      id: true,
      messageId: true,
    },
    take: 5000,
  });
  const deletableIds = candidates
    .filter((event) => !messageHoldIds.has(event.messageId))
    .map((event) => event.id);

  if (!dryRun && deletableIds.length > 0) {
    await prisma.messageEvent.deleteMany({
      where: {
        id: {
          in: deletableIds,
        },
      },
    });
  }

  return {
    checkedCount: candidates.length,
    deletedCount: deletableIds.length,
    skippedCount: candidates.length - deletableIds.length,
  };
}

async function applyProviderWebhookEventRetention({
  cutoffAt,
  dryRun,
}: {
  cutoffAt: Date;
  dryRun: boolean;
}): Promise<RetentionResult> {
  const where = {
    createdAt: {
      lt: cutoffAt,
    },
    status: {
      in: ["SUCCEEDED", "SKIPPED_DUPLICATE"],
    },
  } satisfies Prisma.ProviderWebhookEventWhereInput;
  const checkedCount = await prisma.providerWebhookEvent.count({ where });

  if (!dryRun && checkedCount > 0) {
    await prisma.providerWebhookEvent.deleteMany({ where });
  }

  return {
    checkedCount,
    deletedCount: checkedCount,
    skippedCount: 0,
  };
}

async function applySecurityEventRetention({
  cutoffAt,
  dryRun,
}: {
  cutoffAt: Date;
  dryRun: boolean;
}): Promise<RetentionResult> {
  const where = {
    createdAt: {
      lt: cutoffAt,
    },
    resolvedAt: {
      not: null,
    },
  } satisfies Prisma.SecurityEventWhereInput;
  const checkedCount = await prisma.securityEvent.count({ where });

  if (!dryRun && checkedCount > 0) {
    await prisma.securityEvent.deleteMany({ where });
  }

  return {
    checkedCount,
    deletedCount: checkedCount,
    skippedCount: 0,
  };
}

async function applyStatusPageEmailDeliveryRetention({
  cutoffAt,
  dryRun,
}: {
  cutoffAt: Date;
  dryRun: boolean;
}): Promise<RetentionResult> {
  const where = {
    createdAt: {
      lt: cutoffAt,
    },
    status: {
      in: ["SENT", "FAILED", "SKIPPED"],
    },
  } satisfies Prisma.CompanyNotificationEmailDeliveryWhereInput;
  const checkedCount = await prisma.companyNotificationEmailDelivery.count({
    where,
  });

  if (!dryRun && checkedCount > 0) {
    await prisma.companyNotificationEmailDelivery.deleteMany({ where });
  }

  return {
    checkedCount,
    deletedCount: checkedCount,
    skippedCount: 0,
  };
}

async function applyPublicPrivacyVerificationRetention({
  cutoffAt,
  dryRun,
}: {
  cutoffAt: Date;
  dryRun: boolean;
}): Promise<RetentionResult> {
  const where = {
    createdAt: {
      lt: cutoffAt,
    },
    status: {
      in: ["USED", "EXPIRED", "FAILED"],
    },
  } satisfies Prisma.PublicPrivacyVerificationWhereInput;
  const checkedCount = await prisma.publicPrivacyVerification.count({ where });

  if (!dryRun && checkedCount > 0) {
    await prisma.publicPrivacyVerification.deleteMany({ where });
  }

  return {
    checkedCount,
    deletedCount: checkedCount,
    skippedCount: 0,
  };
}

async function applyPolicy({
  policy,
  runId,
  dryRun,
}: {
  policy: {
    id: string;
    companyId: string | null;
    entityType: DataRetentionEntityType;
    retentionDays: number;
    action: DataRetentionAction;
  };
  runId: string;
  dryRun: boolean;
}) {
  const cutoffAt = cutoffFromRetentionDays(policy.retentionDays);
  let result: RetentionResult = {
    checkedCount: 0,
    deletedCount: 0,
    skippedCount: 0,
  };

  if (policy.action !== "DELETE") {
    result = {
      checkedCount: 0,
      deletedCount: 0,
      skippedCount: 0,
    };
  } else if (policy.entityType === "MESSAGE_EVENT") {
    result = await applyMessageEventRetention({ cutoffAt, dryRun });
  } else if (policy.entityType === "PROVIDER_WEBHOOK_EVENT") {
    result = await applyProviderWebhookEventRetention({ cutoffAt, dryRun });
  } else if (policy.entityType === "SECURITY_EVENT") {
    result = await applySecurityEventRetention({ cutoffAt, dryRun });
  } else if (policy.entityType === "STATUS_PAGE_EMAIL_DELIVERY") {
    result = await applyStatusPageEmailDeliveryRetention({ cutoffAt, dryRun });
  } else if (policy.entityType === "PUBLIC_PRIVACY_VERIFICATION") {
    result = await applyPublicPrivacyVerificationRetention({ cutoffAt, dryRun });
  }

  await prisma.dataRetentionRunItem.create({
    data: {
      runId,
      companyId: policy.companyId,
      policyId: policy.id,
      entityType: policy.entityType,
      action: policy.action,
      checkedCount: result.checkedCount,
      deletedCount: dryRun ? 0 : result.deletedCount,
      skippedCount: result.skippedCount,
      cutoffAt,
      metadata: json({
        dryRun,
        previewDeleteCount: result.deletedCount,
        retentionDays: policy.retentionDays,
      }),
    },
  });

  await prisma.dataRetentionPolicy.update({
    where: {
      id: policy.id,
    },
    data: {
      lastRunAt: new Date(),
    },
  });

  return result;
}

export async function runDataRetentionPolicies({
  forceDryRun,
}: {
  forceDryRun?: boolean;
} = {}) {
  if (!isEnabled()) {
    return {
      skipped: true,
      reason: "Data retention disabled",
    };
  }

  const dryRun = typeof forceDryRun === "boolean" ? forceDryRun : isDryRun();
  const run = await prisma.dataRetentionRun.create({
    data: {
      status: "RUNNING",
      dryRun,
    },
  });

  try {
    const policies = await prisma.dataRetentionPolicy.findMany({
      where: {
        status: "ACTIVE",
      },
      orderBy: {
        entityType: "asc",
      },
    });
    let checkedCount = 0;
    let deletedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const policy of policies) {
      try {
        const result = await applyPolicy({
          policy,
          runId: run.id,
          dryRun,
        });

        checkedCount += result.checkedCount;
        deletedCount += dryRun ? 0 : result.deletedCount;
        skippedCount += result.skippedCount;
      } catch (error) {
        failedCount += 1;

        await prisma.dataRetentionRunItem.create({
          data: {
            runId: run.id,
            companyId: policy.companyId,
            policyId: policy.id,
            entityType: policy.entityType,
            action: policy.action,
            cutoffAt: cutoffFromRetentionDays(policy.retentionDays),
            failedCount: 1,
            errorMessage:
              error instanceof Error ? error.message : "Unknown retention error",
          },
        });

        logger.error("Data retention policy failed", {
          error,
          policyId: policy.id,
          entityType: policy.entityType,
        });
      }
    }

    const completed = await prisma.dataRetentionRun.update({
      where: {
        id: run.id,
      },
      data: {
        status: failedCount > 0 ? "FAILED" : "COMPLETED",
        checkedCount,
        deletedCount,
        skippedCount,
        failedCount,
        completedAt: new Date(),
      },
      include: {
        items: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (failedCount > 0 && shouldCreateIncidents()) {
      await createIncident({
        title: "Data retention run failed",
        description: `${failedCount} data retention policy item(s) failed.`,
        source: "SYSTEM",
        severity: "HIGH",
        idempotencyKey: `data-retention-run-failed:${run.id}`,
        metadata: {
          runId: run.id,
          failedCount,
        },
      }).catch(() => undefined);
    }

    return completed;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown data retention error";

    await prisma.dataRetentionRun.update({
      where: {
        id: run.id,
      },
      data: {
        status: "FAILED",
        errorMessage: message,
        completedAt: new Date(),
      },
    });

    throw error;
  }
}

export async function getDataRetentionHealth() {
  const [activePolicies, latestRun, failedRuns24h, activeLegalHolds] =
    await Promise.all([
      prisma.dataRetentionPolicy.count({
        where: {
          status: "ACTIVE",
        },
      }),
      prisma.dataRetentionRun.findFirst({
        orderBy: {
          startedAt: "desc",
        },
      }),
      prisma.dataRetentionRun.count({
        where: {
          status: "FAILED",
          startedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.legalHold.count({
        where: {
          active: true,
        },
      }),
    ]);

  return {
    enabled: isEnabled(),
    dryRun: isDryRun(),
    activePolicies,
    latestRun,
    failedRuns24h,
    activeLegalHolds,
    isHealthy: isEnabled() && activePolicies > 0 && failedRuns24h === 0,
  };
}

export async function listDataRetentionRuns() {
  return prisma.dataRetentionRun.findMany({
    orderBy: {
      startedAt: "desc",
    },
    take: 50,
    include: {
      items: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

export async function listDataRetentionPolicies() {
  return prisma.dataRetentionPolicy.findMany({
    orderBy: {
      entityType: "asc",
    },
  });
}

export async function listLegalHolds() {
  return prisma.legalHold.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });
}

export async function createLegalHold({
  companyId,
  entityType,
  entityId,
  reason,
  createdByUserId,
}: {
  companyId?: string | null;
  entityType: "CONTACT" | "COMPANY" | "MESSAGE" | "PRIVACY_REQUEST" | "INCIDENT";
  entityId: string;
  reason: string;
  createdByUserId?: string | null;
}) {
  return prisma.legalHold.create({
    data: {
      companyId: companyId ?? null,
      entityType,
      entityId,
      reason,
      createdByUserId: createdByUserId ?? null,
    },
  });
}

export async function releaseLegalHold({
  legalHoldId,
  releasedByUserId,
}: {
  legalHoldId: string;
  releasedByUserId?: string | null;
}) {
  return prisma.legalHold.update({
    where: {
      id: legalHoldId,
    },
    data: {
      active: false,
      releasedAt: new Date(),
      releasedByUserId: releasedByUserId ?? null,
    },
  });
}
