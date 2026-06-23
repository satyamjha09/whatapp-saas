import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { seedDefaultUptimeMonitors } from "@/server/services/uptime-monitoring.service";
import { logger } from "@/server/utils/safe-logger";

async function main() {
  const results = await seedDefaultUptimeMonitors();

  logger.info("Uptime monitors seeded", {
    results,
  });
}

void main()
  .catch((error) => {
    logger.error("Uptime monitor seed failed", {
      error,
    });

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
