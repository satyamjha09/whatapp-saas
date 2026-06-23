import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { cleanupDeveloperDataRetention } from "@/server/services/developer-data-retention.service";
import { assertCompanyFeature } from "@/server/services/feature-gate.service";

export async function POST() {
  try {
    const context = await getCurrentWorkspaceContext();
    if (!context) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (!context.membership) {
      return NextResponse.json(
        { message: "Complete company onboarding first" },
        { status: 403 },
      );
    }
    if (
      context.membership.role !== "OWNER" &&
      context.membership.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { message: "Only owners and admins can run retention cleanup" },
        { status: 403 },
      );
    }

    const companyId = context.membership.companyId;
    await assertCompanyFeature(companyId, "DEVELOPER_API");
    const result = await cleanupDeveloperDataRetention({ companyId });

    await createAuditLog({
      companyId,
      actorUserId: context.user.id,
      action: "developer.retention_cleanup.run",
      entityType: "Company",
      entityId: companyId,
      metadata: {
        retentionDays: result.retentionDays,
        deleted: result.deleted,
      },
    });

    return NextResponse.json({
      message: "Developer data retention cleanup completed",
      result,
    });
  } catch (error) {
    console.error("DEVELOPER_RETENTION_CLEANUP_ERROR:", error);

    if (
      error instanceof Error &&
      (error.message.includes("DEVELOPER_API is not available") ||
        error.message === "Subscription is past due")
    ) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { message: "Unable to run developer retention cleanup" },
      { status: 500 },
    );
  }
}
