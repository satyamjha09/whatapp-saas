import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { retryFailedCompanyNotificationEmailDeliveries } from "@/server/services/company-notification-email-retry.service";

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
        { message: "Only owners and admins can retry failed email deliveries" },
        { status: 403 },
      );
    }

    const result = await retryFailedCompanyNotificationEmailDeliveries({
      companyId: context.membership.companyId,
      limit: 100,
    });

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "notifications.email_delivery.retry_failed",
      entityType: "Company",
      entityId: context.membership.companyId,
      metadata: {
        retriedCount: result.retriedCount,
      },
    });

    return NextResponse.json({
      message: "Failed email deliveries queued for retry",
      ...result,
    });
  } catch (error) {
    console.error("RETRY_FAILED_NOTIFICATION_EMAIL_DELIVERIES_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to retry failed email deliveries" },
      { status: 500 },
    );
  }
}
