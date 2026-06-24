import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { syncUsageCountersForCompany } from "@/server/services/usage-quota.service";
import { logger } from "@/server/utils/safe-logger";

async function main() {
  const companies = await prisma.company.findMany({
    select: {
      id: true,
      name: true,
    },
  });

  let synced = 0;

  for (const company of companies) {
    const result = await syncUsageCountersForCompany({
      companyId: company.id,
    });

    logger.info("Usage quotas synced for company", {
      companyId: company.id,
      companyName: company.name,
      result,
    });

    synced += 1;
  }

  logger.info("Usage quota sync completed", {
    companies: synced,
  });
}

void main()
  .catch((error) => {
    logger.error("Usage quota sync failed", {
      error,
    });

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
