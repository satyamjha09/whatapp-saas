import { CampaignThroughputMode, Prisma } from "@/generated/prisma/client";
import { getRedisConnection } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";

export class CampaignThroughputGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignThroughputGuardError";
  }
}

type ThroughputDecision =
  | {
      allowed: true;
      delayMs: number;
      mode: CampaignThroughputMode;
    }
  | {
      allowed: false;
      reason: string;
      retryAfterMs: number;
      mode: CampaignThroughputMode;
    };

function isEnabled() {
  return process.env.CAMPAIGN_THROUGHPUT_GUARD_ENABLED !== "false";
}

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function defaultPerMinute() {
  return positiveNumber(process.env.CAMPAIGN_THROUGHPUT_DEFAULT_PER_MINUTE, 60);
}

function defaultPerHour() {
  return positiveNumber(process.env.CAMPAIGN_THROUGHPUT_DEFAULT_PER_HOUR, 1000);
}

function defaultMinDelayMs() {
  return nonNegativeNumber(process.env.CAMPAIGN_THROUGHPUT_MIN_DELAY_MS, 250);
}

function defaultSlowModeMultiplier() {
  const value = Number(process.env.CAMPAIGN_THROUGHPUT_SLOW_MODE_MULTIPLIER ?? 0.25);

  return Number.isFinite(value) && value > 0 && value <= 1 ? value : 0.25;
}

function autoSlowdownEnabled() {
  return process.env.CAMPAIGN_THROUGHPUT_AUTO_SLOWDOWN_ENABLED !== "false";
}

function autoPauseOnQualityError() {
  return process.env.CAMPAIGN_THROUGHPUT_AUTO_PAUSE_ON_QUALITY_ERROR !== "false";
}

function cooldownMinutes() {
  return positiveNumber(process.env.CAMPAIGN_THROUGHPUT_RATE_LIMIT_COOLDOWN_MINUTES, 30);
}

function redisPrefix() {
  return process.env.CAMPAIGN_THROUGHPUT_REDIS_PREFIX || "campaign-throughput";
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(redactSensitiveData(value))) as Prisma.InputJsonValue;
}

function minuteKey(campaignId: string) {
  return `${redisPrefix()}:${campaignId}:minute:${Math.floor(Date.now() / 60_000)}`;
}

function hourKey(campaignId: string) {
  return `${redisPrefix()}:${campaignId}:hour:${Math.floor(Date.now() / 3_600_000)}`;
}

function getEffectiveLimit({
  limit,
  mode,
  multiplier,
}: {
  limit: number;
  mode: CampaignThroughputMode;
  multiplier: Prisma.Decimal;
}) {
  if (mode !== "SLOW") return limit;

  const factor = Number(multiplier);
  const safeFactor = Number.isFinite(factor) && factor > 0 && factor <= 1 ? factor : 0.25;

  return Math.max(1, Math.floor(limit * safeFactor));
}

function isRateLimitError({
  errorCode,
  errorMessage,
}: {
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  const text = `${errorCode ?? ""} ${errorMessage ?? ""}`.toLowerCase();

  return (
    text.includes("rate limit") ||
    text.includes("too many requests") ||
    text.includes("throttle") ||
    text.includes("131048") ||
    text.includes("retry-after")
  );
}

function isQualityError({
  errorCode,
  errorMessage,
}: {
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  const text = `${errorCode ?? ""} ${errorMessage ?? ""}`.toLowerCase();

  return (
    text.includes("quality") ||
    text.includes("policy") ||
    text.includes("waba disabled") ||
    text.includes("phone number quality") ||
    text.includes("template paused")
  );
}

function cooldownUntil() {
  return new Date(Date.now() + cooldownMinutes() * 60_000);
}

async function incrementRedisCounter(key: string, ttlSeconds: number) {
  const redis = getRedisConnection();
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, ttlSeconds);
  }

  return count;
}

export async function ensureCampaignThroughputPolicy({
  campaignId,
  companyId,
}: {
  campaignId: string;
  companyId: string;
}) {
  if (!isEnabled()) {
    throw new CampaignThroughputGuardError("Campaign Throughput Guard is disabled.");
  }

  return prisma.campaignThroughputPolicy.upsert({
    where: { campaignId },
    create: {
      campaignId,
      companyId,
      maxPerMinute: defaultPerMinute(),
      maxPerHour: defaultPerHour(),
      minDelayMs: defaultMinDelayMs(),
      autoSlowdownEnabled: autoSlowdownEnabled(),
      autoPauseOnQualityError: autoPauseOnQualityError(),
      slowModeMultiplier: new Prisma.Decimal(defaultSlowModeMultiplier()),
    },
    update: {},
  });
}

async function logThroughputEvent({
  afterMode,
  beforeMode,
  campaignId,
  companyId,
  errorCode,
  errorMessage,
  message,
  metadata,
  policyId,
  retryAfterMs,
  severity,
  title,
  type,
}: {
  afterMode?: CampaignThroughputMode | null;
  beforeMode?: CampaignThroughputMode | null;
  campaignId: string;
  companyId: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  message: string;
  metadata?: unknown;
  policyId?: string | null;
  retryAfterMs?: number | null;
  severity: "INFO" | "WARNING" | "CRITICAL";
  title: string;
  type:
    | "THROTTLED"
    | "RATE_LIMIT_HIT"
    | "AUTO_SLOWDOWN"
    | "AUTO_RECOVERY"
    | "AUTO_PAUSE"
    | "QUALITY_WARNING"
    | "QUALITY_BLOCK"
    | "MANUAL_POLICY_UPDATE";
}) {
  return prisma.campaignThroughputEvent.create({
    data: {
      afterMode: afterMode ?? null,
      beforeMode: beforeMode ?? null,
      campaignId,
      companyId,
      errorCode: errorCode ?? null,
      errorMessage: errorMessage ?? null,
      message,
      metadata: metadata === undefined ? undefined : safeJson(metadata),
      policyId: policyId ?? null,
      retryAfterMs: retryAfterMs ?? null,
      severity,
      title,
      type,
    },
  });
}

export async function acquireCampaignSendSlot({
  campaignId,
  companyId,
}: {
  campaignId?: string | null;
  companyId: string;
}): Promise<ThroughputDecision> {
  if (!campaignId || !isEnabled()) {
    return { allowed: true, delayMs: 0, mode: "NORMAL" };
  }

  const policy = await ensureCampaignThroughputPolicy({ campaignId, companyId });

  if (policy.status === "DISABLED") {
    return { allowed: true, delayMs: 0, mode: policy.mode };
  }

  if (policy.mode === "PAUSED") {
    return {
      allowed: false,
      mode: "PAUSED",
      reason: "Campaign throughput policy is paused.",
      retryAfterMs: 60_000,
    };
  }

  if (policy.rateLimitCooldownUntil && policy.rateLimitCooldownUntil > new Date()) {
    return {
      allowed: false,
      mode: policy.mode,
      reason: "Campaign is cooling down after provider rate limit.",
      retryAfterMs: Math.max(1000, policy.rateLimitCooldownUntil.getTime() - Date.now()),
    };
  }

  const effectivePerMinute = getEffectiveLimit({
    limit: policy.maxPerMinute,
    mode: policy.mode,
    multiplier: policy.slowModeMultiplier,
  });
  const effectivePerHour = getEffectiveLimit({
    limit: policy.maxPerHour,
    mode: policy.mode,
    multiplier: policy.slowModeMultiplier,
  });

  const [minuteCount, hourCount] = await Promise.all([
    incrementRedisCounter(minuteKey(campaignId), 120),
    incrementRedisCounter(hourKey(campaignId), 7200),
  ]);

  if (minuteCount > effectivePerMinute || hourCount > effectivePerHour) {
    const retryAfterMs = minuteCount > effectivePerMinute ? 60_000 : 3_600_000;

    await logThroughputEvent({
      campaignId,
      companyId,
      message: "Campaign send was delayed to stay within configured throughput limits.",
      metadata: {
        effectivePerHour,
        effectivePerMinute,
        hourCount,
        minuteCount,
      },
      policyId: policy.id,
      retryAfterMs,
      severity: "INFO",
      title: "Campaign send throttled",
      type: "THROTTLED",
    }).catch(() => undefined);

    return {
      allowed: false,
      mode: policy.mode,
      reason: "Campaign throughput limit reached.",
      retryAfterMs,
    };
  }

  return {
    allowed: true,
    delayMs: policy.minDelayMs,
    mode: policy.mode,
  };
}

export async function recordCampaignProviderFailureForThroughput({
  campaignId,
  companyId,
  errorCode,
  errorMessage,
  retryAfterMs,
}: {
  campaignId?: string | null;
  companyId: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  retryAfterMs?: number | null;
}) {
  if (!campaignId || !isEnabled()) return null;

  const policy = await ensureCampaignThroughputPolicy({ campaignId, companyId });
  const rateLimit = isRateLimitError({ errorCode, errorMessage });
  const quality = isQualityError({ errorCode, errorMessage });

  if (!rateLimit && !quality) return null;

  if (rateLimit) {
    const beforeMode = policy.mode;
    const afterMode =
      policy.autoSlowdownEnabled && policy.mode === "NORMAL" ? "SLOW" : policy.mode;
    const effectiveRetryAfterMs = retryAfterMs ?? cooldownMinutes() * 60_000;

    const updated = await prisma.campaignThroughputPolicy.update({
      where: { id: policy.id },
      data: {
        lastRateLimitAt: new Date(),
        mode: afterMode,
        rateLimitCooldownUntil: retryAfterMs
          ? new Date(Date.now() + retryAfterMs)
          : cooldownUntil(),
      },
    });

    await logThroughputEvent({
      afterMode,
      beforeMode,
      campaignId,
      companyId,
      errorCode,
      errorMessage,
      message:
        afterMode === "SLOW"
          ? "Campaign was moved to slow mode after a provider rate limit."
          : "Provider rate limit detected.",
      policyId: policy.id,
      retryAfterMs: effectiveRetryAfterMs,
      severity: "WARNING",
      title: "Provider rate limit detected",
      type: "RATE_LIMIT_HIT",
    });

    if (beforeMode !== afterMode) {
      await logThroughputEvent({
        afterMode,
        beforeMode,
        campaignId,
        companyId,
        message: "Campaign throughput was reduced automatically.",
        policyId: policy.id,
        severity: "WARNING",
        title: "Campaign auto-slowdown applied",
        type: "AUTO_SLOWDOWN",
      });
    }

    return updated;
  }

  const beforeMode = policy.mode;
  const afterMode = policy.autoPauseOnQualityError ? "PAUSED" : policy.mode;

  const updated = await prisma.campaignThroughputPolicy.update({
    where: { id: policy.id },
    data: {
      lastQualityWarningAt: new Date(),
      mode: afterMode,
    },
  });

  await logThroughputEvent({
    afterMode,
    beforeMode,
    campaignId,
    companyId,
    errorCode,
    errorMessage,
    message:
      afterMode === "PAUSED"
        ? "Campaign throughput was paused because a quality or policy error was detected."
        : "Quality or policy warning detected. Review campaign before continuing.",
    policyId: policy.id,
    severity: "CRITICAL",
    title: "WhatsApp quality or policy warning detected",
    type: afterMode === "PAUSED" ? "QUALITY_BLOCK" : "QUALITY_WARNING",
  });

  if (afterMode === "PAUSED") {
    await logThroughputEvent({
      afterMode,
      beforeMode,
      campaignId,
      companyId,
      message: "Campaign throughput was auto-paused to protect WABA quality.",
      policyId: policy.id,
      severity: "CRITICAL",
      title: "Campaign auto-paused",
      type: "AUTO_PAUSE",
    });
  }

  return updated;
}

export async function updateCampaignThroughputPolicy({
  actorUserId,
  campaignId,
  companyId,
  maxPerHour,
  maxPerMinute,
  minDelayMs,
  mode,
}: {
  actorUserId?: string | null;
  campaignId: string;
  companyId: string;
  maxPerHour?: number | null;
  maxPerMinute?: number | null;
  minDelayMs?: number | null;
  mode?: "NORMAL" | "SLOW" | "PAUSED";
}) {
  const policy = await ensureCampaignThroughputPolicy({ campaignId, companyId });

  const updated = await prisma.campaignThroughputPolicy.update({
    where: { id: policy.id },
    data: {
      maxPerHour: maxPerHour ?? policy.maxPerHour,
      maxPerMinute: maxPerMinute ?? policy.maxPerMinute,
      minDelayMs: minDelayMs ?? policy.minDelayMs,
      mode: mode ?? policy.mode,
      rateLimitCooldownUntil: mode === "NORMAL" ? null : policy.rateLimitCooldownUntil,
      updatedByUserId: actorUserId ?? null,
    },
  });

  await logThroughputEvent({
    afterMode: updated.mode,
    beforeMode: policy.mode,
    campaignId,
    companyId,
    message: "A user updated campaign throughput settings.",
    metadata: {
      maxPerHour: updated.maxPerHour,
      maxPerMinute: updated.maxPerMinute,
      minDelayMs: updated.minDelayMs,
    },
    policyId: policy.id,
    severity: "INFO",
    title: "Campaign throughput policy updated",
    type: "MANUAL_POLICY_UPDATE",
  });

  await createAuditLog({
    action: "campaign.throughput_policy_updated",
    actorUserId: actorUserId ?? undefined,
    companyId,
    entityId: policy.id,
    entityType: "CampaignThroughputPolicy",
    metadata: safeJson({
      after: updated,
      before: policy,
      campaignId,
    }),
  }).catch(() => undefined);

  return updated;
}

export async function getCampaignThroughputDashboard({
  campaignId,
  companyId,
}: {
  campaignId?: string | null;
  companyId: string;
}) {
  const where = {
    companyId,
    ...(campaignId ? { campaignId } : {}),
  };

  const [policies, events, snapshots] = await Promise.all([
    prisma.campaignThroughputPolicy.findMany({
      where,
      include: {
        updatedByUser: {
          select: {
            email: true,
            id: true,
            name: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.campaignThroughputEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.campaignThroughputSnapshot.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return {
    events,
    policies,
    snapshots,
  };
}

export async function getCampaignThroughputGuardHealth() {
  const since24h = new Date(Date.now() - 86_400_000);

  const [slowCampaigns, pausedCampaigns, rateLimitEvents24h, qualityEvents24h] =
    await Promise.all([
      prisma.campaignThroughputPolicy.count({
        where: { mode: "SLOW", status: "ACTIVE" },
      }),
      prisma.campaignThroughputPolicy.count({
        where: { mode: "PAUSED", status: "ACTIVE" },
      }),
      prisma.campaignThroughputEvent.count({
        where: {
          createdAt: { gte: since24h },
          type: "RATE_LIMIT_HIT",
        },
      }),
      prisma.campaignThroughputEvent.count({
        where: {
          createdAt: { gte: since24h },
          type: { in: ["QUALITY_WARNING", "QUALITY_BLOCK", "AUTO_PAUSE"] },
        },
      }),
    ]);

  return {
    enabled: isEnabled(),
    isHealthy: isEnabled() && qualityEvents24h === 0,
    pausedCampaigns,
    qualityEvents24h,
    rateLimitEvents24h,
    slowCampaigns,
  };
}
