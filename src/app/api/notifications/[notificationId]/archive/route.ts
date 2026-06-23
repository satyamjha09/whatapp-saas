import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { archiveCompanyNotification } from "@/server/services/company-notification.service";

type NotificationRouteContext = {
  params: Promise<{ notificationId: string }>;
};

export async function POST(
  _request: Request,
  { params }: NotificationRouteContext,
) {
  try {
    const { notificationId } = await params;
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

    await archiveCompanyNotification({
      companyId: context.membership.companyId,
      userId: context.user.id,
      notificationId,
    });

    return NextResponse.json({ message: "Notification archived" });
  } catch (error) {
    console.error("ARCHIVE_NOTIFICATION_ERROR:", error);
    return NextResponse.json(
      { message: "Unable to archive notification" },
      { status: 500 },
    );
  }
}
