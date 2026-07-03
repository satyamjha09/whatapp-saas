import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import {
  sendTransactionalEmail,
  verifyTransactionalEmailConnection,
} from "@/server/services/transactional-email.service";
import { getAppBaseUrl } from "@/server/utils/app-url";

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
        { message: "Only owners and admins can send test emails" },
        { status: 403 },
      );
    }

    if (process.env.NOTIFICATION_EMAILS_ENABLED !== "true") {
      return NextResponse.json(
        { message: "Notification emails are disabled" },
        { status: 400 },
      );
    }

    if (!context.user.email) {
      return NextResponse.json(
        { message: "Current user does not have an email address" },
        { status: 400 },
      );
    }

    await verifyTransactionalEmailConnection();

    const appBaseUrl = getAppBaseUrl();

    await sendTransactionalEmail({
      to: context.user.email,
      subject: "[metawhat] Test notification email",
      text: [
        "metawhat test email",
        "",
        "Your SMTP configuration is working.",
        "",
        `Dashboard: ${appBaseUrl}/dashboard/notifications`,
      ].join("\n"),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2>metawhat test email</h2>
          <p>Your SMTP configuration is working.</p>
          <p>
            <a href="${appBaseUrl}/dashboard/notifications">
              Open Notifications
            </a>
          </p>
        </div>
      `,
    });

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "notifications.email_delivery.test_email_sent",
      entityType: "Company",
      entityId: context.membership.companyId,
      metadata: {
        toEmail: context.user.email,
      },
    });

    return NextResponse.json({
      message: "Test email sent",
    });
  } catch (error) {
    console.error("SEND_NOTIFICATION_TEST_EMAIL_ERROR:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to send test email",
      },
      { status: 500 },
    );
  }
}
