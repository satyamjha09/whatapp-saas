import crypto from "crypto";
import { Prisma } from "@/generated/prisma/client";
import { getMessageQueue } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export class CampaignFailureIntelligenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignFailureIntelligenceError";
  }
}

type FailureClassification = {
  category:
    | "INVALID_PHONE"
    | "TEMPLATE_ERROR"
    | "TEMPLATE_VARIABLE_ERROR"
    | "INSUFFICIENT_WALLET"
    | "QUOTA_EXCEEDED"
    | "RATE_LIMIT"
    | "OUTSIDE_24H_WINDOW"
    | "CONTACT_OPTED_OUT"
    | "CONSENT_MISSING"
    | "PROVIDER_TIMEOUT"
    | "META_TEMPORARY"
    | "META_PERMANENT"
    | "WEBHOOK_ERROR"
    | "UNKNOWN";
  severity: "INFO" | "WARNING" | "CRITICAL";
  retrySafety: "SAFE_TO_RETRY" | "RETRY_AFTER_FIX" | "DO_NOT_RETRY";
  suggestedFix: string;
  technicalDetails?: string;
};

function isEnabled() {
  return process.env.CAMPAIGN_FAILURE_INTELLIGENCE_ENABLED !== "false";
}

function safeRetryEnabled() {
  return process.env.CAMPAIGN_FAILURE_SAFE_RETRY_ENABLED !== "false";
}

function maxRetryPerGroup() {
  const value = Number(process.env.CAMPAIGN_FAILURE_MAX_RETRY_PER_GROUP ?? 5000);
  return Number.isFinite(value) && value > 0 ? value : 5000;
}

function sampleSize() {
  const value = Number(process.env.CAMPAIGN_FAILURE_ANALYSIS_SAMPLE_SIZE ?? 20);
  return Number.isFinite(value) && value > 0 ? value : 20;
}

function staleHours() {
  const value = Number(process.env.CAMPAIGN_FAILURE_STALE_HOURS ?? 24);
  return Number.isFinite(value) && value > 0 ? value : 24;
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function cleanText(value?: string | null) {
  return String(value ?? "").trim();
}

function normalizeErrorText(value: string) {
  return value
    .toLowerCase()
    .replace(/\d{6,}/g, "<number>")
    .replace(/[a-f0-9]{16,}/g, "<id>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function signature(input: {
  errorCode?: string | null;
  errorMessage?: string | null;
  category: string;
}) {
  const base = `${input.category}:${cleanText(input.errorCode)}:${normalizeErrorText(cleanText(input.errorMessage))}`;
  return crypto.createHash("sha256").update(base).digest("hex");
}

function phoneLast4(phone?: string | null) {
  return String(phone ?? "").replace(/\D/g, "").slice(-4);
}

function rawReason(raw: Prisma.JsonValue | null | undefined) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = (raw as Record<string, unknown>).reason;
  return typeof value === "string" ? value : null;
}

function classifyFailure(input: {
  errorCode?: string | null;
  errorMessage?: string | null;
}): FailureClassification {
  const code = cleanText(input.errorCode).toLowerCase();
  const message = cleanText(input.errorMessage).toLowerCase();
  const combined = `${code} ${message}`;

  if (
    combined.includes("invalid phone") ||
    combined.includes("invalid number") ||
    combined.includes("recipient phone") ||
    combined.includes("131026")
  ) {
    return {
      category: "INVALID_PHONE",
      severity: "WARNING",
      retrySafety: "DO_NOT_RETRY",
      suggestedFix:
        "Fix or remove invalid phone numbers. Do not retry until the contact number is corrected.",
      technicalDetails: "Phone number was rejected by validation or provider.",
    };
  }

  if (
    combined.includes("template not found") ||
    combined.includes("template rejected") ||
    combined.includes("template paused") ||
    combined.includes("template disabled") ||
    combined.includes("not approved")
  ) {
    return {
      category: "TEMPLATE_ERROR",
      severity: "CRITICAL",
      retrySafety: "RETRY_AFTER_FIX",
      suggestedFix:
        "Check the WhatsApp template status in Meta. Use only approved templates, then retry this group.",
      technicalDetails: "Template is unavailable, rejected, paused, or not approved.",
    };
  }

  if (
    combined.includes("variable") ||
    combined.includes("parameter") ||
    combined.includes("placeholder") ||
    combined.includes("body params") ||
    combined.includes("template parameter")
  ) {
    return {
      category: "TEMPLATE_VARIABLE_ERROR",
      severity: "CRITICAL",
      retrySafety: "RETRY_AFTER_FIX",
      suggestedFix:
        "Fix template variable mapping. Make sure every recipient has values for all required placeholders, then run dry run again.",
      technicalDetails: "Template placeholders or parameters are missing or invalid.",
    };
  }

  if (
    combined.includes("wallet") ||
    combined.includes("balance") ||
    combined.includes("insufficient funds") ||
    combined.includes("insufficient wallet")
  ) {
    return {
      category: "INSUFFICIENT_WALLET",
      severity: "CRITICAL",
      retrySafety: "RETRY_AFTER_FIX",
      suggestedFix: "Add wallet balance or reduce campaign size, then retry failed messages.",
      technicalDetails: "Message failed because account balance was insufficient.",
    };
  }

  if (
    combined.includes("quota") ||
    combined.includes("limit exceeded") ||
    combined.includes("plan limit")
  ) {
    return {
      category: "QUOTA_EXCEEDED",
      severity: "CRITICAL",
      retrySafety: "RETRY_AFTER_FIX",
      suggestedFix: "Upgrade plan, wait for quota reset, or reduce recipients, then retry.",
      technicalDetails: "Plan or usage quota blocked sending.",
    };
  }

  if (
    combined.includes("rate limit") ||
    combined.includes("too many requests") ||
    combined.includes("throttle") ||
    combined.includes("131048")
  ) {
    return {
      category: "RATE_LIMIT",
      severity: "WARNING",
      retrySafety: "SAFE_TO_RETRY",
      suggestedFix:
        "Retry after some time. Consider lowering campaign throughput or batching smaller groups.",
      technicalDetails: "Provider or Meta rate limit was hit.",
    };
  }

  if (
    combined.includes("24 hour") ||
    combined.includes("24-hour") ||
    combined.includes("outside customer service window") ||
    combined.includes("conversation window")
  ) {
    return {
      category: "OUTSIDE_24H_WINDOW",
      severity: "WARNING",
      retrySafety: "RETRY_AFTER_FIX",
      suggestedFix:
        "Use an approved template message outside the 24-hour window. Free-form replies cannot be sent.",
      technicalDetails: "Message attempted outside WhatsApp customer service window.",
    };
  }

  if (
    combined.includes("opted out") ||
    combined.includes("unsubscribe") ||
    combined.includes("blocked by user")
  ) {
    return {
      category: "CONTACT_OPTED_OUT",
      severity: "INFO",
      retrySafety: "DO_NOT_RETRY",
      suggestedFix:
        "Do not retry opted-out contacts. Keep them suppressed unless they opt in again.",
      technicalDetails: "Contact has opted out or blocked messages.",
    };
  }

  if (
    combined.includes("consent") ||
    combined.includes("permission denied") ||
    combined.includes("missing consent")
  ) {
    return {
      category: "CONSENT_MISSING",
      severity: "WARNING",
      retrySafety: "DO_NOT_RETRY",
      suggestedFix:
        "Do not send marketing messages to contacts without consent. Get opt-in first.",
      technicalDetails: "Consent guard blocked sending.",
    };
  }

  if (
    combined.includes("timeout") ||
    combined.includes("etimedout") ||
    combined.includes("network") ||
    combined.includes("socket hang up")
  ) {
    return {
      category: "PROVIDER_TIMEOUT",
      severity: "WARNING",
      retrySafety: "SAFE_TO_RETRY",
      suggestedFix: "Safe to retry. This looks like a temporary provider/network timeout.",
      technicalDetails: "Provider request timed out.",
    };
  }

  if (
    combined.includes("webhook") ||
    combined.includes("callback") ||
    combined.includes("signature")
  ) {
    return {
      category: "WEBHOOK_ERROR",
      severity: "WARNING",
      retrySafety: "RETRY_AFTER_FIX",
      suggestedFix:
        "Check webhook processing logs and signature verification. Retry after webhook issue is resolved.",
      technicalDetails: "Webhook or callback processing failed.",
    };
  }

  if (
    combined.includes("temporary") ||
    combined.includes("try again") ||
    combined.includes("service unavailable") ||
    combined.includes(" 500") ||
    combined.includes(" 503")
  ) {
    return {
      category: "META_TEMPORARY",
      severity: "WARNING",
      retrySafety: "SAFE_TO_RETRY",
      suggestedFix: "Safe to retry later. This appears to be a temporary Meta/provider issue.",
      technicalDetails: "Temporary upstream provider error.",
    };
  }

  if (
    combined.includes("policy") ||
    combined.includes("permanent") ||
    combined.includes("not allowed") ||
    combined.includes("quality")
  ) {
    return {
      category: "META_PERMANENT",
      severity: "CRITICAL",
      retrySafety: "RETRY_AFTER_FIX",
      suggestedFix:
        "Review Meta policy, WABA quality, and template compliance before retrying.",
      technicalDetails: "Provider rejected request due to policy, quality, or permanent validation error.",
    };
  }

  return {
    category: "UNKNOWN",
    severity: "WARNING",
    retrySafety: "RETRY_AFTER_FIX",
    suggestedFix:
      "Review the provider error and logs. Retry only after confirming this is not a permanent issue.",
    technicalDetails: "Failure could not be confidently classified.",
  };
}

async function findFailedCampaignMessages(input: {
  companyId: string;
  campaignId: string;
}) {
  return prisma.message.findMany({
    where: {
      companyId: input.companyId,
      campaignId: input.campaignId,
      direction: "OUTBOUND",
      status: "FAILED",
    },
    select: {
      id: true,
      contactId: true,
      errorCode: true,
      errorMessage: true,
      toPhoneNumber: true,
      createdAt: true,
      contact: { select: { phoneNumber: true, countryCode: true } },
      events: {
        where: { status: "FAILED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { raw: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50_000,
  });
}

function messageFailureText(
  message: Awaited<ReturnType<typeof findFailedCampaignMessages>>[number],
) {
  return (
    message.errorMessage ??
    rawReason(message.events[0]?.raw) ??
    "Message failed without a provider reason"
  );
}

export async function analyzeCampaignFailures(input: {
  companyId: string;
  campaignId: string;
  actorUserId?: string | null;
}) {
  if (!isEnabled()) {
    throw new CampaignFailureIntelligenceError("Campaign Failure Intelligence is disabled.");
  }

  try {
    const messages = await findFailedCampaignMessages(input);
    const grouped = new Map<
      string,
      {
        classification: FailureClassification;
        errorCode?: string | null;
        sampleErrorMessage?: string | null;
        messageIds: string[];
        phoneLast4: string[];
      }
    >();

    for (const message of messages) {
      const errorCode = message.errorCode ?? null;
      const errorMessage = messageFailureText(message);
      const classification = classifyFailure({ errorCode, errorMessage });
      const errorSignature = signature({
        errorCode,
        errorMessage,
        category: classification.category,
      });
      const current = grouped.get(errorSignature) ?? {
        classification,
        errorCode,
        sampleErrorMessage: errorMessage,
        messageIds: [],
        phoneLast4: [],
      };
      const last4 = phoneLast4(
        message.toPhoneNumber || `${message.contact.countryCode}${message.contact.phoneNumber}`,
      );

      current.messageIds.push(message.id);
      if (last4) current.phoneLast4.push(last4);
      grouped.set(errorSignature, current);
    }

    const retryableCount = Array.from(grouped.values()).filter(
      (group) => group.classification.retrySafety === "SAFE_TO_RETRY",
    ).length;
    const run = await prisma.campaignFailureInsightRun.create({
      data: {
        companyId: input.companyId,
        campaignId: input.campaignId,
        generatedByUserId: input.actorUserId ?? null,
        status: "GENERATED",
        totalFailedMessages: messages.length,
        insightCount: grouped.size,
        retryableCount,
        nonRetryableCount: grouped.size - retryableCount,
        metadata: safeJson({ analyzedAt: new Date() }),
      },
    });

    for (const [errorSignature, group] of grouped.entries()) {
      const sampleIds = group.messageIds.slice(0, sampleSize());
      const phoneSamples = Array.from(new Set(group.phoneLast4)).slice(0, sampleSize());

      await prisma.campaignFailureInsight.upsert({
        where: {
          companyId_campaignId_errorSignature: {
            companyId: input.companyId,
            campaignId: input.campaignId,
            errorSignature,
          },
        },
        create: {
          companyId: input.companyId,
          campaignId: input.campaignId,
          runId: run.id,
          status: "OPEN",
          category: group.classification.category,
          severity: group.classification.severity,
          retrySafety: group.classification.retrySafety,
          errorSignature,
          errorCode: group.errorCode ?? null,
          sampleErrorMessage: group.sampleErrorMessage ?? null,
          failedMessageCount: group.messageIds.length,
          retryableMessageCount:
            group.classification.retrySafety === "SAFE_TO_RETRY"
              ? group.messageIds.length
              : 0,
          sampleMessageIds: safeJson(sampleIds),
          samplePhoneLast4: safeJson(phoneSamples),
          suggestedFix: group.classification.suggestedFix,
          technicalDetails: group.classification.technicalDetails ?? null,
          lastSeenAt: new Date(),
        },
        update: {
          runId: run.id,
          status: "OPEN",
          category: group.classification.category,
          severity: group.classification.severity,
          retrySafety: group.classification.retrySafety,
          errorCode: group.errorCode ?? null,
          sampleErrorMessage: group.sampleErrorMessage ?? null,
          failedMessageCount: group.messageIds.length,
          retryableMessageCount:
            group.classification.retrySafety === "SAFE_TO_RETRY"
              ? group.messageIds.length
              : 0,
          sampleMessageIds: safeJson(sampleIds),
          samplePhoneLast4: safeJson(phoneSamples),
          suggestedFix: group.classification.suggestedFix,
          technicalDetails: group.classification.technicalDetails ?? null,
          lastSeenAt: new Date(),
        },
      });
    }

    await createAuditLog({
      companyId: input.companyId,
      actorUserId: input.actorUserId,
      action: "campaign.failures_analyzed",
      entityType: "CampaignFailureInsightRun",
      entityId: run.id,
      metadata: safeJson({
        campaignId: input.campaignId,
        totalFailedMessages: messages.length,
        insightCount: grouped.size,
      }),
    }).catch(() => undefined);

    return getCampaignFailureDashboard({
      companyId: input.companyId,
      campaignId: input.campaignId,
    });
  } catch (error) {
    await prisma.campaignFailureInsightRun.create({
      data: {
        companyId: input.companyId,
        campaignId: input.campaignId,
        generatedByUserId: input.actorUserId ?? null,
        status: "FAILED",
        failedAt: new Date(),
        failureReason:
          error instanceof Error ? error.message : "Unknown failure analysis error",
      },
    });

    throw error;
  }
}

export async function getCampaignFailureDashboard(input: {
  companyId: string;
  campaignId?: string | null;
}) {
  const where = {
    companyId: input.companyId,
    ...(input.campaignId ? { campaignId: input.campaignId } : {}),
  };

  const [insights, runs] = await Promise.all([
    prisma.campaignFailureInsight.findMany({
      where,
      include: {
        fixedByUser: { select: { id: true, name: true, email: true } },
        ignoredByUser: { select: { id: true, name: true, email: true } },
        retriedByUser: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ severity: "desc" }, { failedMessageCount: "desc" }],
      take: 200,
    }),
    prisma.campaignFailureInsightRun.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return { insights, runs };
}

export async function retryCampaignFailureInsight(input: {
  companyId: string;
  insightId: string;
  actorUserId?: string | null;
}) {
  if (!safeRetryEnabled()) {
    throw new CampaignFailureIntelligenceError("Safe retry is disabled.");
  }

  const insight = await prisma.campaignFailureInsight.findFirst({
    where: { id: input.insightId, companyId: input.companyId },
  });

  if (!insight) throw new CampaignFailureIntelligenceError("Failure insight not found.");
  if (insight.retrySafety !== "SAFE_TO_RETRY") {
    throw new CampaignFailureIntelligenceError(
      "This failure group is not safe to retry until the root cause is fixed.",
    );
  }

  const messages = await findFailedCampaignMessages({
    companyId: input.companyId,
    campaignId: insight.campaignId,
  });
  const matchingIds = messages
    .filter((message) => {
      const errorCode = message.errorCode ?? null;
      const errorMessage = messageFailureText(message);
      const classification = classifyFailure({ errorCode, errorMessage });
      return (
        signature({
          errorCode,
          errorMessage,
          category: classification.category,
        }) === insight.errorSignature
      );
    })
    .slice(0, maxRetryPerGroup())
    .map((message) => message.id);

  if (matchingIds.length === 0) {
    throw new CampaignFailureIntelligenceError("No matching failed messages found.");
  }

  const retryBatchId = crypto.randomUUID();
  const now = new Date();

  await prisma.message.updateMany({
    where: { companyId: input.companyId, id: { in: matchingIds } },
    data: {
      status: "QUEUED",
      errorCode: null,
      errorMessage: null,
      queuedAt: now,
    },
  });

  await prisma.messageEvent.createMany({
    data: matchingIds.map((messageId) => ({
      companyId: input.companyId,
      messageId,
      status: "QUEUED" as const,
      raw: safeJson({
        source: "campaign_failure_retry",
        insightId: insight.id,
        retryBatchId,
      }),
    })),
  });

  await prisma.campaignContact.updateMany({
    where: {
      companyId: input.companyId,
      campaignId: insight.campaignId,
      message: { is: { id: { in: matchingIds } } },
    },
    data: { status: "QUEUED" },
  });

  const campaign = await prisma.campaign.findFirst({
    where: { id: insight.campaignId, companyId: input.companyId },
    select: { failedCount: true },
  });
  const decrementBy = Math.min(campaign?.failedCount ?? 0, matchingIds.length);

  if (decrementBy > 0) {
    await prisma.campaign.update({
      where: { id: insight.campaignId },
      data: {
        status: "RUNNING",
        failedCount: { decrement: decrementBy },
      },
    });
  }

  await getMessageQueue().addBulk(
    matchingIds.map((messageId) => ({
      name: "send-template-message",
      data: { messageId, companyId: input.companyId },
      opts: { jobId: `retry:${retryBatchId}:${messageId}` },
    })),
  );

  const updatedInsight = await prisma.campaignFailureInsight.update({
    where: { id: insight.id },
    data: {
      status: "RETRIED",
      retriedAt: now,
      retriedByUserId: input.actorUserId ?? null,
      retryBatchId,
      metadata: safeJson({
        retriedMessageCount: matchingIds.length,
      }),
    },
  });

  await createAuditLog({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    action: "campaign.failure_group_retried",
    entityType: "CampaignFailureInsight",
    entityId: insight.id,
    metadata: safeJson({
      campaignId: insight.campaignId,
      retryBatchId,
      retriedMessageCount: matchingIds.length,
    }),
  }).catch(() => undefined);

  return {
    insight: updatedInsight,
    retryBatchId,
    retriedMessageCount: matchingIds.length,
  };
}

export async function updateCampaignFailureInsightStatus(input: {
  companyId: string;
  insightId: string;
  actorUserId?: string | null;
  status: "FIXED" | "IGNORED";
  ignoreReason?: string | null;
}) {
  const existing = await prisma.campaignFailureInsight.findFirst({
    where: { id: input.insightId, companyId: input.companyId },
  });

  if (!existing) throw new CampaignFailureIntelligenceError("Failure insight not found.");

  const insight = await prisma.campaignFailureInsight.update({
    where: { id: existing.id },
    data:
      input.status === "FIXED"
        ? {
            status: "FIXED",
            fixedAt: new Date(),
            fixedByUserId: input.actorUserId ?? null,
          }
        : {
            status: "IGNORED",
            ignoredAt: new Date(),
            ignoredByUserId: input.actorUserId ?? null,
            ignoreReason: input.ignoreReason?.trim() || null,
          },
  });

  await createAuditLog({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    action:
      input.status === "FIXED"
        ? "campaign.failure_group_fixed"
        : "campaign.failure_group_ignored",
    entityType: "CampaignFailureInsight",
    entityId: existing.id,
    metadata: safeJson({
      campaignId: existing.campaignId,
      status: input.status,
      ignoreReason: input.ignoreReason ?? null,
    }),
  }).catch(() => undefined);

  return insight;
}

export async function getCampaignFailureIntelligenceHealth() {
  const staleCutoff = new Date(Date.now() - staleHours() * 60 * 60 * 1000);
  const [openCritical, safeRetryGroups, failedRuns24h, staleOpen] =
    await Promise.all([
      prisma.campaignFailureInsight.count({
        where: { status: "OPEN", severity: "CRITICAL" },
      }),
      prisma.campaignFailureInsight.count({
        where: { status: "OPEN", retrySafety: "SAFE_TO_RETRY" },
      }),
      prisma.campaignFailureInsightRun.count({
        where: {
          status: "FAILED",
          createdAt: { gte: new Date(Date.now() - 86_400_000) },
        },
      }),
      prisma.campaignFailureInsight.count({
        where: { status: "OPEN", lastSeenAt: { lt: staleCutoff } },
      }),
    ]);

  return {
    enabled: isEnabled(),
    safeRetryEnabled: safeRetryEnabled(),
    openCritical,
    safeRetryGroups,
    failedRuns24h,
    staleOpen,
    isHealthy: isEnabled() && failedRuns24h === 0,
  };
}
