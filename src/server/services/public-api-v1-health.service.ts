import { prisma } from "@/lib/prisma";

export async function getPublicApiV1Health() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [processingStale, completed24h, failed24h] = await Promise.all([
    prisma.publicApiIdempotencyRecord.count({
      where: { status: "PROCESSING", lockedUntil: { lt: new Date() } },
    }),
    prisma.publicApiIdempotencyRecord.count({
      where: { status: "COMPLETED", completedAt: { gte: since } },
    }),
    prisma.publicApiIdempotencyRecord.count({
      where: { status: "FAILED", failedAt: { gte: since } },
    }),
  ]);

  const enabled = process.env.PUBLIC_API_V1_ENABLED !== "false";
  const idempotencyEnabled =
    process.env.PUBLIC_API_IDEMPOTENCY_ENABLED !== "false";

  return {
    enabled,
    idempotencyEnabled,
    requireIdempotencyForMutations:
      process.env.PUBLIC_API_REQUIRE_IDEMPOTENCY_FOR_MUTATIONS !== "false",
    processingStale,
    completed24h,
    failed24h,
    isHealthy: enabled && idempotencyEnabled && processingStale === 0,
  };
}
