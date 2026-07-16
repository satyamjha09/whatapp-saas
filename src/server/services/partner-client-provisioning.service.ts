import crypto from "crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { sendTeamInviteTransactionalEmail } from "@/server/email/transactional-email";
import { buildTeamInviteEmail } from "@/server/email/templates/team-invite-email";
import { platformAssignCompanyPlan } from "@/server/services/company-plan-assignment.service";
import { createPlatformAuditLog } from "@/server/services/platform-audit.service";
import { seedCompanySystemRoles } from "@/server/services/rbac-v2.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";
import type { PartnerClientProvisioningInput } from "@/server/validators/partner-client-provisioning.validator";

export class PartnerClientProvisioningError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PartnerClientProvisioningError";
    this.status = status;
  }
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createInviteToken() {
  return crypto.randomBytes(32).toString("hex");
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function planStatusFor(planCode: string) {
  return planCode === "FREE" ? ("TRIAL" as const) : ("ACTIVE" as const);
}

function normalizeInput(input: PartnerClientProvisioningInput) {
  return {
    partnerCompanyId: input.partnerCompanyId.trim(),
    requestedCompanyName: input.requestedCompanyName.trim(),
    requestedOwnerEmail: input.requestedOwnerEmail.trim().toLowerCase(),
    requestedOwnerName: input.requestedOwnerName?.trim() || null,
    requestedPlan: input.requestedPlan,
    requestedPlanDays: input.requestedPlanDays,
    externalClientReference: input.externalClientReference?.trim() || null,
    idempotencyKey: input.idempotencyKey?.trim() || null,
  };
}

async function recordProvisioningEvent({
  jobId,
  message,
  metadata,
  type,
}: {
  jobId: string;
  type:
    | "CREATED"
    | "PROCESSING_STARTED"
    | "CLIENT_COMPANY_CREATED"
    | "RELATIONSHIP_CREATED"
    | "PLAN_ASSIGNED"
    | "OWNER_INVITED"
    | "COMPLETED"
    | "FAILED"
    | "RETRY_SCHEDULED"
    | "RETRY_REQUESTED"
    | "CANCELED";
  message?: string | null;
  metadata?: unknown;
}) {
  return prisma.partnerClientProvisioningEvent.create({
    data: {
      jobId,
      type,
      message: message ?? null,
      metadata: metadata ? safeJson(metadata) : undefined,
    },
  });
}

async function assertPartnerCompany(partnerCompanyId: string) {
  const partner = await prisma.company.findUnique({
    where: {
      id: partnerCompanyId,
    },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
    },
  });

  if (!partner) {
    throw new PartnerClientProvisioningError("Partner company not found.", 404);
  }

  if (partner.type !== "PARTNER") {
    throw new PartnerClientProvisioningError(
      "Selected company is not a partner.",
    );
  }

  if (partner.status === "DISABLED") {
    throw new PartnerClientProvisioningError(
      "Disabled partner companies cannot provision clients.",
    );
  }

  return partner;
}

async function createOwnerInvite({
  actorUserId,
  companyId,
  ownerEmail,
}: {
  companyId: string;
  actorUserId: string;
  ownerEmail: string;
}) {
  const existingPendingInvite = await prisma.companyInvite.findFirst({
    where: {
      companyId,
      email: ownerEmail,
      status: "PENDING",
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      company: {
        select: {
          name: true,
        },
      },
      invitedBy: true,
    },
  });

  if (existingPendingInvite) {
    return {
      invite: existingPendingInvite,
      inviteUrl: null,
      emailResult: {
        skipped: true,
        reason: "Existing pending owner invite reused.",
      },
    };
  }

  const token = createInviteToken();
  const tokenHash = hashToken(token);
  const invite = await prisma.companyInvite.create({
    data: {
      companyId,
      email: ownerEmail,
      role: "OWNER",
      tokenHash,
      invitedByUserId: actorUserId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    include: {
      company: {
        select: {
          name: true,
        },
      },
      invitedBy: true,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const inviteUrl = `${appUrl}/invite/${token}`;
  let emailResult:
    | {
        skipped?: boolean;
        reason?: string;
        messageId?: string;
      }
    | undefined;

  try {
    const email = buildTeamInviteEmail({
      companyName: invite.company.name,
      invitedByName: invite.invitedBy.name,
      invitedByEmail: invite.invitedBy.email,
      role: invite.role,
      inviteUrl,
      expiresAt: invite.expiresAt,
    });

    emailResult = await sendTeamInviteTransactionalEmail({
      to: ownerEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  } catch (error) {
    emailResult = {
      skipped: true,
      reason: error instanceof Error ? error.message : "Invite email failed.",
    };
  }

  return {
    invite,
    inviteUrl,
    emailResult,
  };
}

export async function createPartnerClientProvisioningJob({
  actorUserId,
  idempotencyKey,
  input,
}: {
  actorUserId: string;
  input: PartnerClientProvisioningInput;
  idempotencyKey?: string | null;
}) {
  const normalized = normalizeInput({
    ...input,
    idempotencyKey: input.idempotencyKey || idempotencyKey || undefined,
  });
  const finalIdempotencyKey =
    normalized.idempotencyKey ??
    crypto
      .createHash("sha256")
      .update(
        [
          normalized.partnerCompanyId,
          normalized.requestedCompanyName,
          normalized.requestedOwnerEmail,
          normalized.externalClientReference ?? "",
        ].join(":"),
      )
      .digest("hex");

  await assertPartnerCompany(normalized.partnerCompanyId);

  const existing = await prisma.partnerClientProvisioningJob.findUnique({
    where: {
      idempotencyKey: finalIdempotencyKey,
    },
    include: partnerClientProvisioningJobInclude(),
  });

  if (existing) {
    return existing;
  }

  const job = await prisma.partnerClientProvisioningJob.create({
    data: {
      partnerCompanyId: normalized.partnerCompanyId,
      createdByUserId: actorUserId,
      idempotencyKey: finalIdempotencyKey,
      requestedCompanyName: normalized.requestedCompanyName,
      requestedOwnerEmail: normalized.requestedOwnerEmail,
      requestedOwnerName: normalized.requestedOwnerName,
      requestedPlan: normalized.requestedPlan,
      requestedPlanDays: normalized.requestedPlanDays,
      externalClientReference: normalized.externalClientReference,
      status: "PENDING",
      maxAttempts: 3,
      metadata: safeJson({
        source: "platform_partner_provisioning",
      }),
    },
    include: partnerClientProvisioningJobInclude(),
  });

  await recordProvisioningEvent({
    jobId: job.id,
    type: "CREATED",
    message: "Partner client provisioning job created.",
    metadata: {
      partnerCompanyId: normalized.partnerCompanyId,
      requestedCompanyName: normalized.requestedCompanyName,
      requestedOwnerEmail: normalized.requestedOwnerEmail,
      requestedPlan: normalized.requestedPlan,
    },
  });

  await createPlatformAuditLog({
    actorUserId,
    action: "partner_client_provisioning.created",
    entityType: "PartnerClientProvisioningJob",
    entityId: job.id,
    metadata: {
      partnerCompanyId: normalized.partnerCompanyId,
      requestedCompanyName: normalized.requestedCompanyName,
      requestedOwnerEmail: normalized.requestedOwnerEmail,
      requestedPlan: normalized.requestedPlan,
    },
  }).catch(() => undefined);

  return getPartnerClientProvisioningJob(job.id);
}

function partnerClientProvisioningJobInclude() {
  return {
    partnerCompany: {
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
      },
    },
    clientCompany: {
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
      },
    },
    relationship: true,
    createdByUser: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    events: {
      orderBy: {
        createdAt: "asc" as const,
      },
    },
  };
}

export async function getPartnerClientProvisioningJob(jobId: string) {
  return prisma.partnerClientProvisioningJob.findUnique({
    where: {
      id: jobId,
    },
    include: partnerClientProvisioningJobInclude(),
  });
}

async function markJobFailed({
  error,
  jobId,
}: {
  jobId: string;
  error: unknown;
}) {
  const job = await prisma.partnerClientProvisioningJob.findUnique({
    where: {
      id: jobId,
    },
    select: {
      attemptCount: true,
      maxAttempts: true,
    },
  });
  const message =
    error instanceof Error ? error.message : "Partner client provisioning failed.";
  const shouldRetry = job ? job.attemptCount < job.maxAttempts : false;
  const nextRetryAt =
    shouldRetry && job
      ? new Date(Date.now() + Math.min(job.attemptCount + 1, 3) * 5 * 60 * 1000)
      : null;

  await prisma.partnerClientProvisioningJob.update({
    where: {
      id: jobId,
    },
    data: {
      status: "FAILED",
      lastError: message,
      nextRetryAt,
    },
  });

  await recordProvisioningEvent({
    jobId,
    type: "FAILED",
    message,
    metadata: {
      retryable: Boolean(nextRetryAt),
      nextRetryAt,
      error,
    },
  });

  if (nextRetryAt) {
    await recordProvisioningEvent({
      jobId,
      type: "RETRY_SCHEDULED",
      message: "Provisioning retry scheduled.",
      metadata: {
        nextRetryAt,
      },
    });
  }

  throw new PartnerClientProvisioningError(message);
}

export async function processPartnerClientProvisioningJob({
  actorUserId,
  jobId,
}: {
  jobId: string;
  actorUserId: string;
}) {
  const job = await prisma.partnerClientProvisioningJob.findUnique({
    where: {
      id: jobId,
    },
  });

  if (!job) {
    throw new PartnerClientProvisioningError("Provisioning job not found.", 404);
  }

  if (job.status === "COMPLETED" || job.status === "CANCELED") {
    return getPartnerClientProvisioningJob(job.id);
  }

  try {
    const partner = await assertPartnerCompany(job.partnerCompanyId);

    await prisma.partnerClientProvisioningJob.update({
      where: {
        id: job.id,
      },
      data: {
        status: "PROCESSING",
        attemptCount: {
          increment: 1,
        },
        startedAt: job.startedAt ?? new Date(),
        lastError: null,
      },
    });
    await recordProvisioningEvent({
      jobId: job.id,
      type: "PROCESSING_STARTED",
      message: "Provisioning processing started.",
    });

    let clientCompanyId = job.clientCompanyId;

    if (!clientCompanyId) {
      const clientCompany = await prisma.company.create({
        data: {
          name: job.requestedCompanyName,
          legalName: job.requestedCompanyName,
          type: "PARTNER_CLIENT",
          parentCompanyId: partner.id,
          billingOwnerType: "PARENT_PARTNER",
          status: "PENDING_ONBOARDING",
          billingPlan: job.requestedPlan,
          subscriptionStatus:
            planStatusFor(job.requestedPlan) === "TRIAL" ? "TRIALING" : "ACTIVE",
          channelPartner: partner.name,
        },
      });

      clientCompanyId = clientCompany.id;

      await prisma.partnerClientProvisioningJob.update({
        where: {
          id: job.id,
        },
        data: {
          clientCompanyId,
        },
      });
      await recordProvisioningEvent({
        jobId: job.id,
        type: "CLIENT_COMPANY_CREATED",
        message: "Partner client workspace created.",
        metadata: {
          clientCompanyId,
          companyName: clientCompany.name,
        },
      });
    }

    await seedCompanySystemRoles({ companyId: clientCompanyId });

    let relationshipId = job.relationshipId;

    if (!relationshipId) {
      const relationship = await prisma.partnerClientRelationship.upsert({
        where: {
          partnerCompanyId_clientCompanyId: {
            partnerCompanyId: partner.id,
            clientCompanyId,
          },
        },
        create: {
          partnerCompanyId: partner.id,
          clientCompanyId,
          status: "PROVISIONING",
          createdByUserId: actorUserId,
          externalClientReference: job.externalClientReference,
          metadata: safeJson({
            provisioningJobId: job.id,
          }),
        },
        update: {
          status: "PROVISIONING",
          externalClientReference: job.externalClientReference,
        },
      });

      relationshipId = relationship.id;

      await prisma.partnerClientProvisioningJob.update({
        where: {
          id: job.id,
        },
        data: {
          relationshipId,
        },
      });
      await recordProvisioningEvent({
        jobId: job.id,
        type: "RELATIONSHIP_CREATED",
        message: "Partner-client relationship linked.",
        metadata: {
          relationshipId,
        },
      });
    }

    await platformAssignCompanyPlan({
      companyId: clientCompanyId,
      actorUserId,
      planCode: job.requestedPlan.toLowerCase(),
      status: planStatusFor(job.requestedPlan),
      days: job.requestedPlanDays,
    });
    await recordProvisioningEvent({
      jobId: job.id,
      type: "PLAN_ASSIGNED",
      message: "Client plan assigned.",
      metadata: {
        plan: job.requestedPlan,
        days: job.requestedPlanDays,
      },
    });

    const { emailResult, invite, inviteUrl } = await createOwnerInvite({
      companyId: clientCompanyId,
      actorUserId,
      ownerEmail: job.requestedOwnerEmail,
    });

    await prisma.partnerClientRelationship.update({
      where: {
        id: relationshipId,
      },
      data: {
        status: "INVITED",
        clientOwnerInviteId: invite.id,
      },
    });
    await recordProvisioningEvent({
      jobId: job.id,
      type: "OWNER_INVITED",
      message: "Client owner invite created.",
      metadata: {
        inviteId: invite.id,
        inviteUrl,
        emailResult,
      },
    });

    await prisma.partnerClientProvisioningJob.update({
      where: {
        id: job.id,
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        nextRetryAt: null,
      },
    });
    await recordProvisioningEvent({
      jobId: job.id,
      type: "COMPLETED",
      message: "Partner client provisioning completed.",
      metadata: {
        clientCompanyId,
        relationshipId,
        inviteId: invite.id,
      },
    });

    await createPlatformAuditLog({
      actorUserId,
      action: "partner_client_provisioning.completed",
      entityType: "PartnerClientProvisioningJob",
      entityId: job.id,
      metadata: {
        partnerCompanyId: partner.id,
        clientCompanyId,
        relationshipId,
      },
    }).catch(() => undefined);

    return getPartnerClientProvisioningJob(job.id);
  } catch (error) {
    return markJobFailed({
      jobId: job.id,
      error,
    });
  }
}

export async function retryPartnerClientProvisioningJob({
  actorUserId,
  jobId,
}: {
  jobId: string;
  actorUserId: string;
}) {
  const job = await prisma.partnerClientProvisioningJob.findUnique({
    where: {
      id: jobId,
    },
  });

  if (!job) {
    throw new PartnerClientProvisioningError("Provisioning job not found.", 404);
  }

  if (job.status !== "FAILED") {
    throw new PartnerClientProvisioningError(
      "Only failed provisioning jobs can be retried.",
    );
  }

  await prisma.partnerClientProvisioningJob.update({
    where: {
      id: job.id,
    },
    data: {
      status: "PENDING",
      nextRetryAt: null,
      lastError: null,
    },
  });
  await recordProvisioningEvent({
    jobId: job.id,
    type: "RETRY_REQUESTED",
    message: "Manual provisioning retry requested.",
  });

  return processPartnerClientProvisioningJob({
    jobId,
    actorUserId,
  });
}

export async function listPartnerClientProvisioningJobs({
  limit = 100,
  partnerCompanyId,
}: {
  limit?: number;
  partnerCompanyId?: string;
} = {}) {
  return prisma.partnerClientProvisioningJob.findMany({
    where: {
      ...(partnerCompanyId ? { partnerCompanyId } : {}),
    },
    include: partnerClientProvisioningJobInclude(),
    orderBy: {
      createdAt: "desc",
    },
    take: limit,
  });
}

export async function getPartnerClientProvisioningDashboard() {
  const [partners, jobs, counts] = await Promise.all([
    prisma.company.findMany({
      where: {
        type: "PARTNER",
      },
      select: {
        id: true,
        name: true,
        status: true,
        billingPlan: true,
        createdAt: true,
        partnerClientRelationshipsAsPartner: {
          include: {
            clientCompany: {
              select: {
                id: true,
                name: true,
                status: true,
                billingPlan: true,
                createdAt: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    listPartnerClientProvisioningJobs({
      limit: 100,
    }),
    prisma.partnerClientProvisioningJob.groupBy({
      by: ["status"],
      _count: {
        _all: true,
      },
    }),
  ]);

  return {
    partners,
    jobs,
    counts: Object.fromEntries(
      counts.map((item) => [item.status, item._count._all]),
    ) as Record<string, number>,
  };
}

export async function processDuePartnerClientProvisioningJobs({
  actorUserId,
  limit = 25,
}: {
  actorUserId: string;
  limit?: number;
}) {
  const jobs = await prisma.partnerClientProvisioningJob.findMany({
    where: {
      OR: [
        {
          status: "PENDING",
        },
        {
          status: "FAILED",
          nextRetryAt: {
            lte: new Date(),
          },
        },
      ],
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
  });

  const results = [];

  for (const job of jobs) {
    try {
      results.push(
        await processPartnerClientProvisioningJob({
          actorUserId,
          jobId: job.id,
        }),
      );
    } catch (error) {
      results.push({
        id: job.id,
        ok: false,
        error: error instanceof Error ? error.message : "Failed",
      });
    }
  }

  return {
    processed: results.length,
    results,
  };
}
