import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { runRbacPermissionAudit } from "@/server/services/rbac-permission-audit.service";
import { logger } from "@/server/utils/safe-logger";

async function main() {
  const result = await runRbacPermissionAudit();
  logger.info("RBAC permission audit completed", {
    skipped: "skipped" in result ? result.skipped : false,
    ...("status" in result
      ? {
          status: result.status,
          totalRoutes: result.totalRoutes,
          guardedRoutes: result.guardedRoutes,
          missingRegistry: result.missingRegistry,
          missingGuards: result.missingGuards,
          findings: result.items.map((item) => ({
            severity: item.severity,
            routePath: item.routePath,
            permission: item.requiredPermission,
          })),
        }
      : { reason: result.reason }),
  });
  if ("status" in result && result.status === "FAILED") process.exitCode = 1;
}

void main()
  .catch((error) => {
    logger.error("RBAC permission audit failed", { error });
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
