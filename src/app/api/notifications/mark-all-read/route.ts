import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { markAllCompanyNotificationsRead } from "@/server/services/company-notification.service";

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

    const result = await markAllCompanyNotificationsRead({
      companyId: context.membership.companyId,
      userId: context.user.id,
    });

    return NextResponse.json({
      message: "All notifications marked as read",
      updatedCount: result.count,
    });
  } catch (error) {
    console.error("MARK_ALL_NOTIFICATIONS_READ_ERROR:", error);
    return NextResponse.json(
      { message: "Unable to mark notifications as read" },
      { status: 500 },
    );
  }
}
