import { prisma } from "@/lib/prisma";
import {
  completeMaintenanceJobRun,
  failMaintenanceJobRun,
  startMaintenanceJobRun,
} from "@/server/services/maintenance-job.service";

export const CAMPAIGN_THROUGHPUT_SNAPSHOT_JOB = "campaign-throughput-snapshot";

export async function runCampaignThroughputSnapshotJob() {
  const jobRun = await startMaintenanceJobRun(CAMPAIGN_THROUGHPUT_SNAPSHOT_JOB);

  try {
    const policies = await prisma.campaignThroughputPolicy.findMany({
      where: { status: "ACTIVE" },
      take: 500,
    });

    let created = 0;
    const since24h = new Date(Date.now() - 86_400_000);
    const since1h = new Date(Date.now() - 3_600_000);
    const since1m = new Date(Date.now() - 60_000);

    for (const policy of policies) {
      const [
        rateLimitEvents24h,
        qualityEvents24h,
        throttledCount,
        sentLastMinute,
        sentLastHour,
      ] = await Promise.all([
        prisma.campaignThroughputEvent.count({
          where: {
            campaignId: policy.campaignId,
            companyId: policy.companyId,
            createdAt: { gte: since24h },
            type: "RATE_LIMIT_HIT",
          },
        }),
        prisma.campaignThroughputEvent.count({
          where: {
            campaignId: policy.campaignId,
            companyId: policy.companyId,
            createdAt: { gte: since24h },
            type: { in: ["QUALITY_WARNING", "QUALITY_BLOCK", "AUTO_PAUSE"] },
          },
        }),
        prisma.campaignThroughputEvent.count({
          where: {
            campaignId: policy.campaignId,
            companyId: policy.companyId,
            createdAt: { gte: since1h },
            type: "THROTTLED",
          },
        }),
        prisma.message.count({
          where: {
            campaignId: policy.campaignId,
            companyId: policy.companyId,
            events: {
              some: {
                createdAt: { gte: since1m },
                status: "SENT",
              },
            },
          },
        }),
        prisma.message.count({
          where: {
            campaignId: policy.campaignId,
            companyId: policy.companyId,
            events: {
              some: {
                createdAt: { gte: since1h },
                status: "SENT",
              },
            },
          },
        }),
      ]);

      await prisma.campaignThroughputSnapshot.create({
        data: {
          campaignId: policy.campaignId,
          companyId: policy.companyId,
          isHealthy: qualityEvents24h === 0,
          maxPerHour: policy.maxPerHour,
          maxPerMinute: policy.maxPerMinute,
          mode: policy.mode,
          qualityEvents24h,
          rateLimitEvents24h,
          sentLastHour,
          sentLastMinute,
          throttledCount,
        },
      });

      created += 1;
    }

    await completeMaintenanceJobRun({
      checkedCount: policies.length,
      jobRunId: jobRun.id,
      recoveredCount: created,
    });

    return {
      created,
      policies: policies.length,
    };
  } catch (error) {
    await failMaintenanceJobRun({
      errorMessage:
        error instanceof Error
          ? error.message
          : "Unknown campaign throughput snapshot error",
      jobRunId: jobRun.id,
    });

    throw error;
  }
}
