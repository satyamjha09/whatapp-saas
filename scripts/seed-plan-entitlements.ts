import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { seedPlanEntitlements } from "@/server/services/feature-entitlement.service";
import { logger } from "@/server/utils/safe-logger";

async function main() {
  const entitlements = await seedPlanEntitlements();
  logger.info("Plan entitlements seeded", { count: entitlements.length });
}

void main()
  .catch((error) => {
    logger.error("Plan entitlement seed failed", { error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
