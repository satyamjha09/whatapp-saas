import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { seedDefaultTrustDocuments } from "@/server/services/trust-center.service";
import { logger } from "@/server/utils/safe-logger";

async function main() {
  const documents = await seedDefaultTrustDocuments();

  logger.info("Trust Center documents seeded", {
    count: documents.length,
    documents: documents.map(({ type, version }) => ({ type, version })),
  });
}

void main()
  .catch((error) => {
    logger.error("Trust Center seed failed", { error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
