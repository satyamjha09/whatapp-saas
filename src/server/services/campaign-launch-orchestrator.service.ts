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

  if (!["QUEUING", "WALLET_RESERVED", "DRY_RUN_CONFIRMED", "DRY_RUN_CREATED"].includes(launchRun.status)) {
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
    return prisma.campaignLaunchRun.update({
      where: { id: launchRun.id },
      data: {
        status: "RUNNING",
        queuedAt: new Date(),
      },
    });
  }

  const contacts = await prisma.contact.findMany({
    where: {
      companyId: input.companyId,
      id: { in: planned.map((recipient) => recipient.contactId).filter(Boolean) as string[] },
    },
  });
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const chargePaise = planned.length * MESSAGE_PRICE_PAISE;

  const transactionResult = await prisma.$transaction(async (tx) => {
    const debitResult = await tx.wallet.updateMany({
      where: {
        companyId: input.companyId,
        balancePaise: { gte: chargePaise },
      },
      data: { balancePaise: { decrement: chargePaise } },
    });

    if (debitResult.count !== 1) {
      throw new CampaignLaunchOrchestratorError("Insufficient wallet balance");
    }

    const walletTransaction = await tx.walletTransaction.create({
      data: {
        companyId: input.companyId,
        type: "DEBIT",
        status: "SUCCESS",
        amountPaise: chargePaise,
        description: `${planned.length} campaign launch message(s) queued`,
        referenceType: "CAMPAIGN_LAUNCH_USAGE",
        referenceId: `${launchRun.id}:${planned[0]?.id}`,
      },
    });

    const messages: Array<{ id: string; recipientId: string }> = [];

    for (const recipient of planned) {
      const contact = recipient.contactId ? contactById.get(recipient.contactId) : null;

      if (!contact) {
        await tx.campaignLaunchRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "FAILED",
            failureReason: "Contact not found",
          },
        });
        continue;
      }

      const campaignContact = await tx.campaignContact.upsert({
        where: {
          campaignId_contactId: {
            campaignId: launchRun.campaignId,
            contactId: contact.id,
          },
        },
        update: {
          status: "QUEUED",
          variables: asStringArray(recipient.bodyParameters),
        },
        create: {
          companyId: input.companyId,
          campaignId: launchRun.campaignId,
          contactId: contact.id,
          status: "QUEUED",
          variables: asStringArray(recipient.bodyParameters),
        },
      });

      const message = await tx.message.create({
        data: {
          companyId: input.companyId,
          contactId: contact.id,
          templateId: launchRun.templateId,
          campaignId: launchRun.campaignId,
          campaignContactId: campaignContact.id,
          direction: "OUTBOUND",
          status: "QUEUED",
          toPhoneNumber: `${contact.countryCode}${contact.phoneNumber}`,
          body: recipient.renderedPreview ?? launchRun.templateBody,
          variables: asStringArray(recipient.bodyParameters),
          events: {
            create: {
              companyId: input.companyId,
              status: "QUEUED",
              raw: {
                source: "campaign_launch",
                launchRunId: launchRun.id,
              },
            },
          },
        },
      });

      await tx.campaignLaunchRecipient.update({
        where: { id: recipient.id },
        data: {
          status: "QUEUED",
          messageId: message.id,
        },
      });

      messages.push({ id: message.id, recipientId: recipient.id });
    }

    if (messages.length > 0) {
      await tx.messageUsageLedger.createMany({
        data: messages.map((message) => ({
          companyId: input.companyId,
          messageId: message.id,
          walletTransactionId: walletTransaction.id,
          status: "CHARGED" as const,
          amountPaise: MESSAGE_PRICE_PAISE,
        })),
      });
    }

    await tx.campaignWalletReservation.updateMany({
      where: {
        companyId: input.companyId,
        launchRunId: launchRun.id,
        status: "RESERVED",
      },
      data: {
        consumedAmountPaise: { increment: messages.length * MESSAGE_PRICE_PAISE },
      },
    });

    await tx.campaign.update({
      where: { id: launchRun.campaignId },
      data: {
        status: "RUNNING",
        totalContacts: launchRun.validRecipients,
        queuedCount: { increment: messages.length },
      },
    });

    await tx.campaignLaunchRun.update({
      where: { id: launchRun.id },
      data: {
        createdMessageCount: { increment: messages.length },
        queuedMessageCount: { increment: messages.length },
      },
    });

    return { messages };
  });

  if (transactionResult.messages.length > 0) {
    await getMessageQueue().addBulk(
      transactionResult.messages.map((message) => ({
        name: "send-template-message",
        data: { messageId: message.id, companyId: input.companyId },
        opts: { jobId: message.id },
      })),
    );

    await incrementUsageQuota({
      companyId: input.companyId,
      featureKey: "BULK_MESSAGING",
      amount: transactionResult.messages.length,
      idempotencyKey: `campaign-launch-messages-created:${launchRun.id}:${planned[0]?.id}`,
      reason: "campaign-launch-messages-created",
      metadata: {
        launchRunId: launchRun.id,
        campaignId: launchRun.campaignId,
        messageCount: transactionResult.messages.length,
      },
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
        jobId: `campaign-launch:${launchRun.id}:${Date.now()}`,
      },
    );

    return prisma.campaignLaunchRun.update({
      where: { id: launchRun.id },
      data: { status: "QUEUING" },
    });
  }

  return prisma.campaignLaunchRun.update({
    where: { id: launchRun.id },
    data: {
      status: "RUNNING",
      queuedAt: new Date(),
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
