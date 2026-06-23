import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { seedDefaultStatusPage } from "@/server/services/status-page.service";
import { logger } from "@/server/utils/safe-logger";

async function main() {
  const page = await seedDefaultStatusPage();

  logger.info("Status page seeded", {
    pageId: page.id,
    slug: page.slug,
    components: page.components.length,
  });
}

void main()
  .catch((error) => {
    logger.error("Status page seed failed", {
      error,
    });

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
