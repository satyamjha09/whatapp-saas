import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getCompanyNotificationPreferences } from "@/server/services/company-notification-preference.service";
import NotificationPreferencesForm from "./notification-preferences-form";

export default async function NotificationPreferencesPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const preferences = await getCompanyNotificationPreferences({
    companyId: context.membership.companyId,
    userId: context.user.id,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#081B3A]">
            Notification Preferences
          </h1>
          <p className="mt-2 text-sm text-[#526173]">
            Control which workspace alerts appear for your user account.
          </p>
        </div>

        <Link
          href="/dashboard/notifications"
          className="rounded-lg border border-[#BFE9D0] bg-white px-4 py-2 text-sm font-medium text-[#526173] transition hover:bg-[#E7F8EF]"
        >
          Back to Notifications
        </Link>
      </div>

      <NotificationPreferencesForm preferences={preferences} />
    </div>
  );
}
