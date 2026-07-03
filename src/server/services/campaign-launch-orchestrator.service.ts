import crypto from "crypto";
import { Prisma } from "@/generated/prisma/client";
import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { getMessageQueue } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { getBillingPlanConfig } from "@/server/config/billing-plans";
import { getCampaignLaunchQueue } from "@/server/queues/campaign-launch.queue";
import { createAuditLog } from "@/server/services/audit.service";
import {
  assertContactCanReceiveTemplate,
  ConsentRequiredError,
} from "@/server/services/contact-consent.service";
import { assertCompanyFeature } from "@/server/services/feature-gate.service";
import { assertCompanyMessageQuota } from "@/server/services/message-quota.service";
import { assertSubscriptionCanSend } from "@/server/services/subscription-expiry.service";
import {
  assertUsageQuotaAvailable,
  incrementUsageQuota,
} from "@/server/services/usage-quota.service";
import { buildCampaignRecipientsFromSegmentAndMapping } from "@/server/services/template-variable-mapping.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export class CampaignLaunchOrchestratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignLaunchOrchestratorError";
  }
}

type PrepareLaunchInput = {
  companyId: string;
  campaignId: string;
  actorUserId?: string | null;
  idempotencyKey?: string | null;
  segmentId: string;
  templateId?: string | null;
  templateName: string;
  templateLanguage?: string | null;
  templateBody: string;
  templateStatus?: string | null;
  templateCategory?: string | null;
  estimatedCostPaise?: number | null;
};

type MappedRecipient = Awaited<
  ReturnType<typeof buildCampaignRecipientsFromSegmentAndMapping>
>[number];

function isEnabled() {
  return process.env.CAMPAIGN_LAUNCH_ORCHESTRATOR_ENABLED !== "false";
}

function requireWalletReserve() {
  return process.env.CAMPAIGN_LAUNCH_REQUIRE_WALLET_RESERVE !== "false";
}

function idempotencyRequired() {
  return process.env.CAMPAIGN_LAUNCH_IDEMPOTENCY_REQUIRED !== "false";
}

function launchBatchSize() {
  const value = Number(process.env.CAMPAIGN_LAUNCH_BATCH_SIZE ?? 500);
  return Number.isFinite(value) && value > 0 ? value : 500;
}

function maxRecipients() {
  const value = Number(process.env.CAMPAIGN_LAUNCH_MAX_RECIPIENTS ?? 50_000);
  return Number.isFinite(value) && value > 0 ? value : 50_000;
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function normalizedPhone(recipient: Pick<MappedRecipient, "countryCode" | "phoneNumber">) {
  return `${recipient.countryCode}${recipient.phoneNumber}`.replace(/\D/g, "");
}

function maskPhone(phone: string) {
  const clean = phone.replace(/\D/g, "");
  return `${"*".repeat(Math.max(clean.length - 4, 0))}${clean.slice(-4)}`;
}

function launchKey(input?: string | null) {
  return input?.trim() || crypto.randomUUID();
}

function templateCategory(value?: string | null) {
  return value === "MARKETING" || value === "UTILITY" || value === "AUTHENTICATION"
    ? value
    : "UTILITY";
}

function asStringArray(value: Prisma.JsonValue | null | undefined) {
  return Array.isArray(value) ? value.map(String) : [];
}

async function getWalletBalance(companyId: string) {
  return prisma.wallet.findUnique({
    where: { companyId },
    select: { id: true, balancePaise: true },
  });
}

async function runLaunchDryRun(input: {
  companyId: string;
  templateCategory?: string | null;
  recipients: MappedRecipient[];
}) {
  const seen = new Set<string>();
  const validRecipients: MappedRecipient[] = [];
  const skippedRecipients: Array<{ recipient: MappedRecipient; reason: string }> = [];

  for (const recipient of input.recipients) {
    const phone = normalizedPhone(recipient);

    if (seen.has(phone)) {
      skippedRecipients.push({ recipient, reason: "Duplicate recipient" });
      continue;
    }

    seen.add(phone);

    if (!recipient.contactId) {
      skippedRecipients.push({ recipient, reason: "Recipient is not linked to a contact" });
      continue;
    }

    if (recipient.isBlocked) {
      skippedRecipients.push({ recipient, reason: "Contact is blocked" });
      continue;
    }

    try {
      await assertContactCanReceiveTemplate({
        companyId: input.companyId,
        contactId: recipient.contactId,
        templateCategory: templateCategory(input.templateCategory),
      });
    } catch (error) {
      if (error instanceof ConsentRequiredError) {
        skippedRecipients.push({ recipient, reason: error.message });
        continue;
      }

      throw error;
    }

    validRecipients.push(recipient);
  }

  return {
    id: crypto.randomUUID(),
    status: validRecipients.length > 0 ? "PASSED" : "FAILED",
    canStart: validRecipients.length > 0,
    totalRecipients: input.recipients.length,
    validRecipients: validRecipients.length,
    skippedRecipients: skippedRecipients.length,
    failedRecipients: validRecipients.length > 0 ? 0 : input.recipients.length,
    estimatedCostPaise: validRecipients.length * MESSAGE_PRICE_PAISE,
    valid: validRecipients,
    skipped: skippedRecipients,
  };
}

export async function prepareCampaignLaunch(input: PrepareLaunchInput) {
  if (!isEnabled()) {
    throw new CampaignLaunchOrchestratorError("Campaign Launch Orchestrator is disabled.");
  }

  if (idempotencyRequired() && !input.idempotencyKey?.trim()) {
    throw new CampaignLaunchOrchestratorError("Idempotency key is required.");
  }

  await assertCompanyFeature(input.companyId, "BULK_CAMPAIGNS");

  const key = launchKey(input.idempotencyKey);
  const existing = await prisma.campaignLaunchRun.findUnique({
    where: {
      companyId_campaignId_idempotencyKey: {
        companyId: input.companyId,
        campaignId: input.campaignId,
        idempotencyKey: key,
      },
    },
    include: { recipients: { take: 10 } },
  });

  if (existing) return existing;

  const [campaign, company] = await Promise.all([
    prisma.campaign.findFirst({
      where: { id: input.campaignId, companyId: input.companyId },
      include: { template: true },
    }),
    prisma.company.findUnique({
      where: { id: input.companyId },
      select: { billingPlan: true },
    }),
  ]);

  if (!campaign) throw new CampaignLaunchOrchestratorError("Campaign not found.");
  if (!company) throw new CampaignLaunchOrchestratorError("Company not found.");
  if (campaign.status !== "DRAFT") {
    throw new CampaignLaunchOrchestratorError("Only draft campaigns can be prepared for launch.");
  }

  const template = campaign.template;
  const templateId = input.templateId ?? template.id;
  const templateName = input.templateName || template.name;
  const templateLanguage = input.templateLanguage ?? template.language;
  const templateBody = input.templateBody || template.body;
  const templateCategoryValue = input.templateCategory ?? template.category;

  if (template.status !== "APPROVED" || input.templateStatus === "REJECTED") {
    throw new CampaignLaunchOrchestratorError("Campaign template is not approved.");
  }

  const plan = getBillingPlanConfig(company.billingPlan);
  const recipientLimit = Math.min(maxRecipients(), plan.maxBulkRecipients);
  const recipients = await buildCampaignRecipientsFromSegmentAndMapping({
    companyId: input.companyId,
    segmentId: input.segmentId,
    templateName,
    templateLanguage,
    templateBody,
    limit: recipientLimit + 1,
  });

  if (recipients.length === 0) {
    throw new CampaignLaunchOrchestratorError("No recipients matched this segment.");
  }

  if (recipients.length > recipientLimit) {
    throw new CampaignLaunchOrchestratorError(
      `Campaign cannot exceed ${recipientLimit.toLocaleString("en-IN")} recipients.`,
    );
  }

  const dryRun = await runLaunchDryRun({
    companyId: input.companyId,
    templateCategory: templateCategoryValue,
    recipients,
  });

  if (dryRun.validRecipients > 0) {
    await assertSubscriptionCanSend(input.companyId);
    await assertCompanyMessageQuota(input.companyId, dryRun.validRecipients);
    await assertUsageQuotaAvailable({
      companyId: input.companyId,
      featureKey: "BULK_MESSAGING",
      amount: dryRun.validRecipients,
    });
  }

  const launchRun = await prisma.$transaction(async (tx) => {
    const created = await tx.campaignLaunchRun.create({
      data: {
        companyId: input.companyId,
        campaignId: input.campaignId,
        createdByUserId: input.actorUserId ?? null,
        status: dryRun.canStart ? "DRY_RUN_CREATED" : "FAILED",
        idempotencyKey: key,
        templateId,
        templateName,
        templateLanguage,
        templateBody,
        templateCategory: templateCategoryValue,
        segmentId: input.segmentId,
        dryRunId: dryRun.id,
        totalRecipients: dryRun.totalRecipients,
        validRecipients: dryRun.validRecipients,
        skippedRecipients: dryRun.skippedRecipients,
        failedRecipients: dryRun.failedRecipients,
        estimatedCostPaise: input.estimatedCostPaise ?? dryRun.estimatedCostPaise,
        failureReason: dryRun.canStart ? null : "Dry run failed.",
        metadata: safeJson({
          dryRunStatus: dryRun.status,
          dryRunCanStart: dryRun.canStart,
        }),
      },
    });

    await tx.campaignLaunchRecipient.createMany({
      data: [
        ...dryRun.valid.map((recipient) => ({
          companyId: input.companyId,
          launchRunId: created.id,
          campaignId: input.campaignId,
          contactId: recipient.contactId ?? null,
          status: "PLANNED" as const,
          phoneMasked: maskPhone(normalizedPhone(recipient)),
          phoneLast4: normalizedPhone(recipient).slice(-4),
          variables: safeJson(recipient.variables ?? {}),
          bodyParameters: safeJson(recipient.bodyParameters),
          renderedPreview: recipient.renderedBody ?? null,
        })),
        ...dryRun.skipped.map(({ recipient, reason }) => ({
          companyId: input.companyId,
          launchRunId: created.id,
          campaignId: input.campaignId,
          contactId: recipient.contactId ?? null,
          status: "SKIPPED" as const,
          phoneMasked: maskPhone(normalizedPhone(recipient)),
          phoneLast4: normalizedPhone(recipient).slice(-4),
          variables: safeJson(recipient.variables ?? {}),
          bodyParameters: safeJson(recipient.bodyParameters),
          renderedPreview: recipient.renderedBody ?? null,
          failureReason: reason,
        })),
      ],
    });

    return created;
  });

  await createAuditLog({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    action: "campaign.launch_prepared",
    entityType: "CampaignLaunchRun",
    entityId: launchRun.id,
    metadata: safeJson({
      campaignId: input.campaignId,
      segmentId: input.segmentId,
      dryRunId: dryRun.id,
      validRecipients: dryRun.validRecipients,
      estimatedCostPaise: dryRun.estimatedCostPaise,
    }),
  }).catch(() => undefined);

  return launchRun;
}

export async function reserveCampaignWallet(input: {
  companyId: string;
  launchRunId: string;
}) {
  const launchRun = await prisma.campaignLaunchRun.findFirst({
    where: { id: input.launchRunId, companyId: input.companyId },
  });

  if (!launchRun) throw new CampaignLaunchOrchestratorError("Launch run not found.");
  if (!requireWalletReserve()) return null;

  const wallet = await getWalletBalance(input.companyId);

  if (!wallet) throw new CampaignLaunchOrchestratorError("Wallet not found.");
  if (wallet.balancePaise < launchRun.estimatedCostPaise) {
    throw new CampaignLaunchOrchestratorError("Wallet balance is not enough for campaign launch.");
  }

  const existing = await prisma.campaignWalletReservation.findFirst({
    where: {
      companyId: input.companyId,
      launchRunId: launchRun.id,
      campaignId: launchRun.campaignId,
      status: "RESERVED",
    },
  });

  if (existing) return existing;

  const reservation = await prisma.campaignWalletReservation.create({
    data: {
      companyId: input.companyId,
      launchRunId: launchRun.id,
      campaignId: launchRun.campaignId,
      amountPaise: launchRun.estimatedCostPaise,
      reason: "Campaign launch estimated cost reservation",
      metadata: safeJson({
        walletId: wallet.id,
        balanceBeforePaise: wallet.balancePaise,
      }),
    },
  });

  await prisma.campaignLaunchRun.update({
    where: { id: launchRun.id },
    data: {
      status: "WALLET_RESERVED",
      reservedAmountPaise: reservation.amountPaise,
    },
  });

  return reservation;
}

export async function confirmAndQueueCampaignLaunch(input: {
  companyId: string;
  launchRunId: string;
  actorUserId?: string | null;
}) {
  const launchRun = await prisma.campaignLaunchRun.findFirst({
    where: { id: input.launchRunId, companyId: input.companyId },
  });

  if (!launchRun) throw new CampaignLaunchOrchestratorError("Launch run not found.");

  if (["QUEUING", "QUEUED", "RUNNING", "COMPLETED"].includes(launchRun.status)) {
    return launchRun;
  }

  if (!["DRY_RUN_CREATED", "DRY_RUN_CONFIRMED", "WALLET_RESERVED"].includes(launchRun.status)) {
    throw new CampaignLaunchOrchestratorError("Launch run is not ready to queue.");
  }

  await reserveCampaignWallet({
    companyId: input.companyId,
    launchRunId: launchRun.id,
  });

  const updated = await prisma.campaignLaunchRun.update({
    where: { id: launchRun.id },
    data: {
      status: "QUEUING",
      startedAt: new Date(),
    },
  });

  await getCampaignLaunchQueue().add(
    "queue-campaign-messages",
    {
      companyId: input.companyId,
      launchRunId: launchRun.id,
      campaignId: launchRun.campaignId,
    },
    { jobId: `campaign-launch:${launchRun.id}` },
  );

  await createAuditLog({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    action: "campaign.launch_queued",
    entityType: "CampaignLaunchRun",
    entityId: launchRun.id,
    metadata: safeJson({
      campaignId: launchRun.campaignId,
      estimatedCostPaise: launchRun.estimatedCostPaise,
    }),
  }).catch(() => undefined);

  return updated;
}

export async function queueCampaignMessagesFromLaunch(input: {
  companyId: string;
  launchRunId: string;
}) {
  const launchRun = await prisma.campaignLaunchRun.findFirst({
    where: { id: input.launchRunId, companyId: input.companyId },
  });

  if (!launchRun) throw new CampaignLaunchOrchestratorError("Launch run not found.");

  if (
    ![
      "QUEUING",
      "RUNNING",
      "WALLET_RESERVED",
      "DRY_RUN_CONFIRMED",
      "DRY_RUN_CREATED",
    ].includes(launchRun.status)
  ) {
    return launchRun;
  }

  const claim = await prisma.campaignLaunchRun.updateMany({
    where: {
      id: launchRun.id,
      companyId: input.companyId,
      status: {
        in: ["QUEUING", "WALLET_RESERVED", "DRY_RUN_CONFIRMED", "DRY_RUN_CREATED"],
      },
    },
    data: {
      startedAt: launchRun.startedAt ?? new Date(),
      status: "RUNNING",
    },
  });

  if (claim.count === 0 && launchRun.status !== "RUNNING") {
    return launchRun;
  }

  const planned = await prisma.campaignLaunchRecipient.findMany({
    where: {
      companyId: input.companyId,
      launchRunId: launchRun.id,
      status: "PLANNED",
      contactId: { not: null },
    },
    orderBy: { createdAt: "asc" },
    take: launchBatchSize(),
  });

  if (planned.length === 0) {
    const unfinished = await prisma.campaignLaunchRecipient.count({
      where: {
        companyId: input.companyId,
        launchRunId: launchRun.id,
        status: {
          in: ["PLANNED", "PROCESSING"],
        },
      },
    });

    if (unfinished > 0) return launchRun;

    const finalRun = await prisma.campaignLaunchRun.update({
      where: { id: launchRun.id },
      data: {
        completedAt: new Date(),
        status:
          launchRun.failedRecipients > 0 && launchRun.queuedMessageCount === 0
            ? "FAILED"
            : "COMPLETED",
      },
    });

    await prisma.campaign.update({
      where: { id: launchRun.campaignId },
      data: {
        status:
          launchRun.failedRecipients > 0 && launchRun.queuedMessageCount === 0
            ? "FAILED"
            : "COMPLETED",
      },
    });

    return finalRun;
  }

  const recipientIds = planned.map((recipient) => recipient.id);
  const claimed = await prisma.campaignLaunchRecipient.updateMany({
    where: {
      companyId: input.companyId,
      id: { in: recipientIds },
      status: "PLANNED",
    },
    data: {
      status: "PROCESSING",
    },
  });

  if (claimed.count === 0) {
    return launchRun;
  }

  const recipients = await prisma.campaignLaunchRecipient.findMany({
    where: {
      companyId: input.companyId,
      id: { in: recipientIds },
      launchRunId: launchRun.id,
      status: "PROCESSING",
    },
    orderBy: { createdAt: "asc" },
  });

  const queuedMessages: Array<{ id: string }> = [];
  let stopForInsufficientBalance = false;
  let processedCount = 0;

  for (const recipient of recipients) {
    if (!recipient.contactId) {
      await prisma.campaignLaunchRecipient.update({
        where: { id: recipient.id },
        data: {
          failureReason: "Recipient is not linked to a contact",
          skippedAt: new Date(),
          status: "SKIPPED",
        },
      });
      processedCount += 1;
      continue;
    }

    const idempotencyKey = `campaign:${launchRun.campaignId}:launch:${launchRun.id}:recipient:${recipient.id}`;

    const result = await prisma.$transaction(async (tx) => {
      const existingMessage = await tx.message.findFirst({
        where: {
          companyId: input.companyId,
          idempotencyKey,
        },
      });

      if (existingMessage) {
        await tx.campaignLaunchRecipient.update({
          where: { id: recipient.id },
          data: {
            messageId: existingMessage.id,
            queuedAt: existingMessage.queuedAt ?? new Date(),
            status:
              existingMessage.status === "READ"
                ? "READ"
                : existingMessage.status === "DELIVERED"
                  ? "DELIVERED"
                  : existingMessage.status === "SENT"
                    ? "SENT"
                    : existingMessage.status === "FAILED"
                      ? "FAILED"
                      : "QUEUED",
          },
        });

        return {
          messageId: existingMessage.id,
          queued: !["FAILED", "CANCELED"].includes(existingMessage.status),
          reused: true,
          stop: false,
        };
      }

      const [freshRun, contact, template] = await Promise.all([
        tx.campaignLaunchRun.findFirst({
          where: {
            companyId: input.companyId,
            id: launchRun.id,
          },
        }),
        tx.contact.findFirst({
          where: {
            companyId: input.companyId,
            id: recipient.contactId!,
          },
        }),
        launchRun.templateId
          ? tx.template.findFirst({
              where: {
                companyId: input.companyId,
                id: launchRun.templateId,
                status: "APPROVED",
              },
            })
          : Promise.resolve(null),
      ]);

      if (!freshRun || freshRun.status === "CANCELED") {
        await tx.campaignLaunchRecipient.update({
          where: { id: recipient.id },
          data: {
            failureReason: "Campaign launch was canceled",
            skippedAt: new Date(),
            status: "SKIPPED",
          },
        });

        return { queued: false, reused: false, stop: false };
      }

      if (!contact) {
        await tx.campaignLaunchRecipient.update({
          where: { id: recipient.id },
          data: {
            failedAt: new Date(),
            failureReason: "Contact not found",
            status: "FAILED",
          },
        });
        await tx.campaignLaunchRun.update({
          where: { id: launchRun.id },
          data: { failedRecipients: { increment: 1 } },
        });

        return { queued: false, reused: false, stop: false };
      }

      if (contact.isBlocked || contact.optedOutAt) {
        await tx.campaignLaunchRecipient.update({
          where: { id: recipient.id },
          data: {
            failureReason: contact.isBlocked
              ? "Contact is blocked"
              : "Contact has opted out",
            skippedAt: new Date(),
            status: "SKIPPED",
          },
        });
        await tx.campaignLaunchRun.update({
          where: { id: launchRun.id },
          data: { skippedRecipients: { increment: 1 } },
        });

        return { queued: false, reused: false, stop: false };
      }

      if (!template) {
        await tx.campaignLaunchRecipient.update({
          where: { id: recipient.id },
          data: {
            failedAt: new Date(),
            failureReason: "Campaign template is no longer approved",
            status: "FAILED",
          },
        });
        await tx.campaignLaunchRun.update({
          where: { id: launchRun.id },
          data: {
            failedAt: new Date(),
            failureReason: "Campaign template is no longer approved",
            status: "FAILED",
          },
        });
        await tx.campaign.update({
          where: { id: launchRun.campaignId },
          data: { status: "FAILED" },
        });

        return { queued: false, reused: false, stop: true };
      }

      try {
        await assertContactCanReceiveTemplate({
          companyId: input.companyId,
          contactId: contact.id,
          templateCategory: templateCategory(template.category),
        });
      } catch (error) {
        if (!(error instanceof ConsentRequiredError)) throw error;

        await tx.campaignLaunchRecipient.update({
          where: { id: recipient.id },
          data: {
            failureReason: error.message,
            skippedAt: new Date(),
            status: "SKIPPED",
          },
        });
        await tx.campaignLaunchRun.update({
          where: { id: launchRun.id },
          data: { skippedRecipients: { increment: 1 } },
        });

        return { queued: false, reused: false, stop: false };
      }

      const bodyParameters = asStringArray(recipient.bodyParameters);

      if (bodyParameters.length !== template.variables.length) {
        await tx.campaignLaunchRecipient.update({
          where: { id: recipient.id },
          data: {
            failedAt: new Date(),
            failureReason: `Template requires ${template.variables.length} variable value(s)`,
            status: "FAILED",
          },
        });
        await tx.campaignLaunchRun.update({
          where: { id: launchRun.id },
          data: { failedRecipients: { increment: 1 } },
        });

        return { queued: false, reused: false, stop: false };
      }

      if (bodyParameters.some((value) => !value.trim())) {
        await tx.campaignLaunchRecipient.update({
          where: { id: recipient.id },
          data: {
            failedAt: new Date(),
            failureReason: "Required template variable is missing",
            status: "FAILED",
          },
        });
        await tx.campaignLaunchRun.update({
          where: { id: launchRun.id },
          data: { failedRecipients: { increment: 1 } },
        });

        return { queued: false, reused: false, stop: false };
      }

      const debitResult = await tx.wallet.updateMany({
        where: {
          balancePaise: { gte: MESSAGE_PRICE_PAISE },
          companyId: input.companyId,
        },
        data: {
          balancePaise: { decrement: MESSAGE_PRICE_PAISE },
        },
      });

      if (debitResult.count !== 1) {
        await tx.campaignLaunchRecipient.update({
          where: { id: recipient.id },
          data: {
            failedAt: new Date(),
            failureReason: "Insufficient wallet balance",
            status: "FAILED",
          },
        });
        await tx.campaignLaunchRun.update({
          where: { id: launchRun.id },
          data: {
            failedAt: new Date(),
            failureReason: "Insufficient wallet balance",
            status: "FAILED",
          },
        });
        await tx.campaign.update({
          where: { id: launchRun.campaignId },
          data: { status: "FAILED" },
        });

        return { queued: false, reused: false, stop: true };
      }

      const wallet = await tx.wallet.findUnique({
        where: { companyId: input.companyId },
        select: { balancePaise: true },
      });

      const walletTransaction = await tx.walletTransaction.create({
        data: {
          amountPaise: MESSAGE_PRICE_PAISE,
          balanceAfterPaise: wallet?.balancePaise ?? null,
          companyId: input.companyId,
          description: "Campaign launch message queued",
          referenceId: idempotencyKey,
          referenceType: "CAMPAIGN_MESSAGE",
          status: "SUCCESS",
          type: "DEBIT",
        },
      });

      const campaignContact = await tx.campaignContact.upsert({
        where: {
          campaignId_contactId: {
            campaignId: launchRun.campaignId,
            contactId: contact.id,
          },
        },
        update: {
          status: "QUEUED",
          variables: bodyParameters,
        },
        create: {
          campaignId: launchRun.campaignId,
          companyId: input.companyId,
          contactId: contact.id,
          status: "QUEUED",
          variables: bodyParameters,
        },
      });

      const message = await tx.message.create({
        data: {
          body: recipient.renderedPreview ?? launchRun.templateBody,
          campaignContactId: campaignContact.id,
          campaignId: launchRun.campaignId,
          companyId: input.companyId,
          contactId: contact.id,
          direction: "OUTBOUND",
          events: {
            create: {
              companyId: input.companyId,
              raw: {
                idempotencyKey,
                launchRunId: launchRun.id,
                source: "campaign_launch",
              },
              status: "QUEUED",
            },
          },
          idempotencyKey,
          metadata: safeJson({
            campaignLaunchRecipientId: recipient.id,
            launchRunId: launchRun.id,
            source: "campaign_launch",
          }),
          queuedAt: new Date(),
          status: "QUEUED",
          templateId: template.id,
          toPhoneNumber: `${contact.countryCode}${contact.phoneNumber}`,
          variables: bodyParameters,
        },
      });

      await tx.messageUsageLedger.create({
        data: {
          amountPaise: MESSAGE_PRICE_PAISE,
          companyId: input.companyId,
          messageId: message.id,
          status: "CHARGED",
          walletTransactionId: walletTransaction.id,
        },
      });

      await tx.campaignLaunchRecipient.update({
        where: { id: recipient.id },
        data: {
          messageId: message.id,
          queuedAt: new Date(),
          status: "QUEUED",
        },
      });

      await tx.campaignWalletReservation.updateMany({
        where: {
          companyId: input.companyId,
          launchRunId: launchRun.id,
          status: "RESERVED",
        },
        data: {
          consumedAmountPaise: { increment: MESSAGE_PRICE_PAISE },
        },
      });

      await tx.campaign.update({
        where: { id: launchRun.campaignId },
        data: {
          queuedCount: { increment: 1 },
          status: "RUNNING",
          totalContacts: launchRun.validRecipients,
        },
      });

      await tx.campaignLaunchRun.update({
        where: { id: launchRun.id },
        data: {
          createdMessageCount: { increment: 1 },
          queuedMessageCount: { increment: 1 },
        },
      });

      return {
        messageId: message.id,
        queued: true,
        reused: false,
        stop: false,
      };
    });

    processedCount += 1;

    if (result.messageId && result.queued) {
      queuedMessages.push({ id: result.messageId });
    }

    if (result.stop) {
      stopForInsufficientBalance = true;
      break;
    }
  }

  if (queuedMessages.length > 0) {
    await getMessageQueue().addBulk(
      queuedMessages.map((message) => ({
        name: "send-template-message",
        data: { messageId: message.id, companyId: input.companyId },
        opts: { jobId: message.id },
      })),
    );

    await incrementUsageQuota({
      companyId: input.companyId,
      featureKey: "BULK_MESSAGING",
      amount: queuedMessages.length,
      idempotencyKey: `campaign-launch-messages-created:${launchRun.id}:${recipientIds.join(":")}`,
      reason: "campaign-launch-messages-created",
      metadata: {
        launchRunId: launchRun.id,
        campaignId: launchRun.campaignId,
        messageCount: queuedMessages.length,
      },
    });
  }

  if (stopForInsufficientBalance) {
    return prisma.campaignLaunchRun.findUnique({
      where: { id: launchRun.id },
    });
  }

  const remaining = await prisma.campaignLaunchRecipient.count({
    where: {
      companyId: input.companyId,
      launchRunId: launchRun.id,
      status: "PLANNED",
    },
  });

  if (remaining > 0) {
    await getCampaignLaunchQueue().add(
      "queue-campaign-messages",
      {
        companyId: input.companyId,
        launchRunId: launchRun.id,
        campaignId: launchRun.campaignId,
      },
      {
        delay: 1000,
        jobId: `campaign-launch:${launchRun.id}:${processedCount}:${remaining}`,
      },
    );

    return prisma.campaignLaunchRun.update({
      where: { id: launchRun.id },
      data: { status: "RUNNING" },
    });
  }

  return prisma.campaignLaunchRun.update({
    where: { id: launchRun.id },
    data: {
      completedAt: new Date(),
      queuedAt: new Date(),
      status: "COMPLETED",
    },
  }).then(async (updated) => {
    await prisma.campaignWalletReservation.updateMany({
      where: {
        companyId: input.companyId,
        launchRunId: launchRun.id,
        status: "RESERVED",
      },
      data: {
        status: "CONSUMED",
        consumedAt: new Date(),
      },
    });

    return updated;
  });
}

export async function getCampaignLaunchDashboard(input: {
  companyId: string;
  campaignId?: string | null;
}) {
  const where = {
    companyId: input.companyId,
    ...(input.campaignId ? { campaignId: input.campaignId } : {}),
  };

  const [launchRuns, reservations] = await Promise.all([
    prisma.campaignLaunchRun.findMany({
      where,
      include: {
        createdByUser: {
          select: { id: true, name: true, email: true },
        },
        recipients: {
          orderBy: { createdAt: "asc" },
          take: 10,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.campaignWalletReservation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return { launchRuns, reservations };
}

function rate(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 10_000) / 100 : 0;
}

export async function getCampaignLaunchProgress(input: {
  companyId: string;
  campaignId: string;
}) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      companyId: input.companyId,
      id: input.campaignId,
    },
    select: {
      id: true,
      name: true,
      status: true,
    },
  });

  if (!campaign) {
    throw new CampaignLaunchOrchestratorError("Campaign not found.");
  }

  const launchRun = await prisma.campaignLaunchRun.findFirst({
    where: {
      campaignId: input.campaignId,
      companyId: input.companyId,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!launchRun) {
    return {
      campaign,
      launchRun: null,
      rates: {
        deliveredRate: 0,
        failedRate: 0,
        readRate: 0,
        replyRate: 0,
        sentRate: 0,
      },
      recentFailures: [],
    };
  }

  const [statusCounts, recentFailures] = await Promise.all([
    prisma.campaignLaunchRecipient.groupBy({
      by: ["status"],
      where: {
        companyId: input.companyId,
        launchRunId: launchRun.id,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.campaignLaunchRecipient.findMany({
      where: {
        companyId: input.companyId,
        launchRunId: launchRun.id,
        status: "FAILED",
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        contactId: true,
        failedAt: true,
        failureReason: true,
        id: true,
        phoneLast4: true,
        phoneMasked: true,
      },
    }),
  ]);

  const counts = new Map(
    statusCounts.map((item) => [item.status, item._count._all]),
  );
  const sentRecipients =
    (counts.get("SENT") ?? 0) +
    (counts.get("DELIVERED") ?? 0) +
    (counts.get("READ") ?? 0) +
    (counts.get("REPLIED") ?? 0);
  const deliveredRecipients =
    (counts.get("DELIVERED") ?? 0) +
    (counts.get("READ") ?? 0) +
    (counts.get("REPLIED") ?? 0);
  const readRecipients = (counts.get("READ") ?? 0) + (counts.get("REPLIED") ?? 0);
  const repliedRecipients = counts.get("REPLIED") ?? 0;
  const failedRecipients = counts.get("FAILED") ?? 0;
  const skippedRecipients = counts.get("SKIPPED") ?? 0;
  const queuedRecipients =
    (counts.get("QUEUED") ?? 0) +
    sentRecipients;
  const totalRecipients = launchRun.totalRecipients;
  const actualCostPaise = queuedRecipients * MESSAGE_PRICE_PAISE;

  return {
    campaign,
    launchRun: {
      actualCostPaise,
      completedAt: launchRun.completedAt,
      deliveredRecipients,
      estimatedCostPaise: launchRun.estimatedCostPaise,
      failedRecipients,
      id: launchRun.id,
      queuedRecipients,
      readRecipients,
      repliedRecipients,
      sentRecipients,
      skippedRecipients,
      startedAt: launchRun.startedAt,
      status: launchRun.status,
      totalRecipients,
    },
    rates: {
      deliveredRate: rate(deliveredRecipients, totalRecipients),
      failedRate: rate(failedRecipients, totalRecipients),
      readRate: rate(readRecipients, totalRecipients),
      replyRate: rate(repliedRecipients, totalRecipients),
      sentRate: rate(sentRecipients, totalRecipients),
    },
    recentFailures: recentFailures.map((failure) => ({
      contactId: failure.contactId,
      errorMessage: failure.failureReason,
      failedAt: failure.failedAt ?? undefined,
      phoneNumber: failure.phoneMasked ?? failure.phoneLast4 ?? "-",
      recipientId: failure.id,
    })),
  };
}

export async function cancelCampaignLaunch(input: {
  actorUserId?: string | null;
  campaignId: string;
  companyId: string;
}) {
  const launchRun = await prisma.campaignLaunchRun.findFirst({
    where: {
      campaignId: input.campaignId,
      companyId: input.companyId,
      status: {
        in: [
          "DRY_RUN_CREATED",
          "DRY_RUN_CONFIRMED",
          "WALLET_RESERVED",
          "QUEUING",
          "QUEUED",
          "RUNNING",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!launchRun) {
    throw new CampaignLaunchOrchestratorError("Active campaign launch not found.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const skipped = await tx.campaignLaunchRecipient.updateMany({
      where: {
        companyId: input.companyId,
        launchRunId: launchRun.id,
        status: {
          in: ["PLANNED", "PROCESSING"],
        },
      },
      data: {
        failureReason: "Campaign launch canceled",
        skippedAt: new Date(),
        status: "SKIPPED",
      },
    });

    const updatedRun = await tx.campaignLaunchRun.update({
      where: { id: launchRun.id },
      data: {
        completedAt: new Date(),
        failureReason: "Campaign launch canceled",
        skippedRecipients: { increment: skipped.count },
        status: "CANCELED",
      },
    });

    await tx.campaign.update({
      where: { id: input.campaignId },
      data: { status: "CANCELLED" },
    });

    return {
      launchRun: updatedRun,
      skippedRecipients: skipped.count,
    };
  });

  await createAuditLog({
    action: "campaign.launch_canceled",
    actorUserId: input.actorUserId,
    companyId: input.companyId,
    entityId: launchRun.id,
    entityType: "CampaignLaunchRun",
    metadata: safeJson({
      campaignId: input.campaignId,
      skippedRecipients: result.skippedRecipients,
    }),
  }).catch(() => undefined);

  return result;
}

export async function getCampaignLaunchHealth() {
  const [queuing, running, failed24h, queued24h] = await Promise.all([
    prisma.campaignLaunchRun.count({ where: { status: "QUEUING" } }),
    prisma.campaignLaunchRun.count({ where: { status: "RUNNING" } }),
    prisma.campaignLaunchRun.count({
      where: {
        status: "FAILED",
        createdAt: { gte: new Date(Date.now() - 86_400_000) },
      },
    }),
    prisma.campaignLaunchRun.count({
      where: {
        status: { in: ["QUEUED", "RUNNING"] },
        createdAt: { gte: new Date(Date.now() - 86_400_000) },
      },
    }),
  ]);

  return {
    enabled: isEnabled(),
    queuing,
    running,
    failed24h,
    queued24h,
    isHealthy: isEnabled() && failed24h === 0,
  };
}
