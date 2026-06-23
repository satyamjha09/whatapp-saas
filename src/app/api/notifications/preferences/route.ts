import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { updateCompanyNotificationPreference } from "@/server/services/company-notification-preference.service";
import { updateNotificationPreferenceSchema } from "@/server/validators/notification-preference.validator";

export async function PATCH(request: Request) {
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

    const body: unknown = await request.json();
    const validation = updateNotificationPreferenceSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid notification preference",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const preference = await updateCompanyNotificationPreference({
      companyId: context.membership.companyId,
      userId: context.user.id,
      type: validation.data.type,
      inAppEnabled: validation.data.inAppEnabled,
      minimumSeverity: validation.data.minimumSeverity,
      emailEnabled: validation.data.emailEnabled,
      emailMinimumSeverity: validation.data.emailMinimumSeverity,
    });

    return NextResponse.json({
      message: "Notification preference updated",
      preference,
    });
  } catch (error) {
    console.error("UPDATE_NOTIFICATION_PREFERENCE_ERROR:", error);
    return NextResponse.json(
      { message: "Unable to update notification preference" },
      { status: 500 },
    );
  }
}
