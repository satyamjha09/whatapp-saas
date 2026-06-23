import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import {
  cleanupNotificationEmailDeliveryRetention,
  recoverStaleNotificationEmailDeliveries,
} from "@/server/services/company-notification-email-maintenance.service";

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
        { message: "Only owners and admins can run email maintenance" },
        { status: 403 },
      );
    }

    const [recovery, cleanup] = await Promise.all([
      recoverStaleNotificationEmailDeliveries({
        staleAfterMinutes: 30,
        limit: 500,
      }),

      cleanupNotificationEmailDeliveryRetention({
        companyId: context.membership.companyId,
      }),
    ]);

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "notifications.email_delivery.maintenance_run",
      entityType: "Company",
      entityId: context.membership.companyId,
      metadata: {
        recovery: {
          checkedCount: recovery.checkedCount,
          recoveredCount: recovery.recoveredCount,
        },
        cleanup,
      },
    });

    return NextResponse.json({
      message: "Notification email maintenance completed",
      recovery,
      cleanup,
    });
  } catch (error) {
    console.error("NOTIFICATION_EMAIL_MAINTENANCE_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to run notification email maintenance" },
      { status: 500 },
    );
  }
}
