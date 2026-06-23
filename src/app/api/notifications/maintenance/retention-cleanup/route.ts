import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { cleanupCompanyNotificationRetention } from "@/server/services/company-notification-retention.service";

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
        { message: "Only owners and admins can run notification cleanup" },
        { status: 403 },
      );
    }

    const result = await cleanupCompanyNotificationRetention({
      companyId: context.membership.companyId,
    });
    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "notifications.retention_cleanup.run",
      entityType: "Company",
      entityId: context.membership.companyId,
      metadata: result,
    });

    return NextResponse.json({
      message: "Notification retention cleanup completed",
      result,
    });
  } catch (error) {
    console.error("NOTIFICATION_RETENTION_CLEANUP_ERROR:", error);
    return NextResponse.json(
      { message: "Unable to run notification cleanup" },
      { status: 500 },
    );
  }
}
