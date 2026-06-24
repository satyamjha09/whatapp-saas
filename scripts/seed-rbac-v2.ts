import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { seedAllCompanySystemRoles } from "@/server/services/rbac-v2.service";
import { logger } from "@/server/utils/safe-logger";

async function main() {
  const result = await seedAllCompanySystemRoles();
  logger.info("RBAC v2 roles and assignments seeded", result);
}

void main()
  .catch((error) => {
    logger.error("RBAC v2 seed failed", { error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
