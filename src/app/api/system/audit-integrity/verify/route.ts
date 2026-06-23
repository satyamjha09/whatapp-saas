import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { verifyAuditLogIntegrity } from "@/server/services/audit-integrity.service";
import { logger } from "@/server/utils/safe-logger";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context?.membership) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (context.membership.role !== "OWNER") {
      return NextResponse.json(
        { message: "Only owners can verify audit log integrity" },
        { status: 403 },
      );
    }

    const result = await verifyAuditLogIntegrity({
      companyId: context.membership.companyId,
    });

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "audit_log.integrity_verified",
      entityType: "AuditLog",
      entityId: context.membership.companyId,
      metadata: {
        checkedCount: result.checkedCount,
        failureCount: result.failureCount,
        isHealthy: result.isHealthy,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error("Audit integrity verification failed", {
      error,
    });

    return NextResponse.json(
      { message: "Unable to verify audit log integrity" },
      { status: 500 },
    );
  }
}
