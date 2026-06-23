import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { retryCompanyNotificationEmailDelivery } from "@/server/services/company-notification-email-retry.service";

type RouteContext = {
  params: Promise<{
    deliveryId: string;
  }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { deliveryId } = await params;

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
        { message: "Only owners and admins can retry email deliveries" },
        { status: 403 },
      );
    }

    const delivery = await retryCompanyNotificationEmailDelivery({
      companyId: context.membership.companyId,
      deliveryId,
    });

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "notifications.email_delivery.retry",
      entityType: "CompanyNotificationEmailDelivery",
      entityId: delivery.id,
      metadata: {
        previousAttempts: delivery.attempts,
        toEmail: delivery.toEmail,
      },
    });

    return NextResponse.json({
      message: "Email delivery queued for retry",
      delivery,
    });
  } catch (error) {
    console.error("RETRY_NOTIFICATION_EMAIL_DELIVERY_ERROR:", error);

    if (
      error instanceof Error &&
      [
        "Email delivery not found",
        "Sent email deliveries cannot be retried",
      ].includes(error.message)
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to retry email delivery" },
      { status: 500 },
    );
  }
}
