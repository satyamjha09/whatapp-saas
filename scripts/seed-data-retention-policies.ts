import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { seedDefaultDataRetentionPolicies } from "@/server/services/data-retention.service";
import { logger } from "@/server/utils/safe-logger";

async function main() {
  const policies = await seedDefaultDataRetentionPolicies();

  logger.info("Data retention policies seeded", {
    count: policies.length,
    policies: policies.map((policy) => ({
      id: policy.id,
      entityType: policy.entityType,
      retentionDays: policy.retentionDays,
      action: policy.action,
    })),
  });
}

void main()
  .catch((error) => {
    logger.error("Data retention policy seed failed", {
      error,
    });

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
