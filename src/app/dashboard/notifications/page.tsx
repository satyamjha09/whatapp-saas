import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getCompanyNotificationCenter } from "@/server/services/company-notification.service";
import MarkAllReadButton from "./mark-all-read-button";
import NotificationActions from "./notification-actions";
import NotificationRetentionCleanupButton from "./notification-retention-cleanup-button";

function severityClass(severity: string) {
  if (severity === "ERROR") return "bg-red-50 text-red-700";
  if (severity === "WARNING") return "bg-yellow-50 text-yellow-700";
  if (severity === "SUCCESS") return "bg-green-50 text-green-700";
  return "bg-emerald-50 text-emerald-700";
}

export default async function NotificationsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const notificationCenter = await getCompanyNotificationCenter({
    companyId: context.membership.companyId,
    userId: context.user.id,
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#081B3A]">Notifications</h1>
          <p className="mt-2 text-sm text-[#526173]">
            System alerts for billing, wallet, webhooks, campaigns, and
            developer tools.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/notifications/preferences"
            className="rounded-lg border border-[#BFE9D0] bg-white px-4 py-2 text-sm font-medium text-[#526173] transition hover:bg-[#E7F8EF]"
          >
            Preferences
          </Link>
          <Link
            href="/dashboard/notifications/email-deliveries"
            className="rounded-lg border border-[#BFE9D0] bg-white px-4 py-2 text-sm font-medium text-[#526173] transition hover:bg-[#E7F8EF]"
          >
            Email Deliveries
          </Link>
          {notificationCenter.unreadCount > 0 ? <MarkAllReadButton /> : null}
        </div>
      </div>

      <section className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-sm">
          <p className="text-sm text-[#526173]">Unread</p>
          <p className="mt-1 text-2xl font-bold text-[#081B3A]">
            {notificationCenter.unreadCount}
          </p>
        </div>
        <div className="rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-sm">
          <p className="text-sm text-[#526173]">Visible Notifications</p>
          <p className="mt-1 text-2xl font-bold text-[#081B3A]">
            {notificationCenter.notifications.length}
          </p>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-emerald-900">
              Notification Retention
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-emerald-800">
              Read notifications are automatically archived after 30 days. Old
              resolved notifications are deleted after 180 days. Unread alerts
              are preserved.
            </p>
          </div>
          <NotificationRetentionCleanupButton />
        </div>
      </section>

      <section className="space-y-4">
        {notificationCenter.notifications.length === 0 ? (
          <div className="rounded-2xl border border-[#BFE9D0] bg-white p-8 text-sm text-[#526173] shadow-sm">
            No notifications yet.
          </div>
        ) : (
          notificationCenter.notifications.map((notification) => (
            <article
              key={notification.id}
              className={`rounded-2xl border bg-white p-5 shadow-sm ${
                notification.status === "UNREAD"
                  ? "border-[#128C7E]"
                  : "border-[#BFE9D0]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${severityClass(notification.severity)}`}
                    >
                      {notification.severity}
                    </span>
                    <span className="rounded-full bg-[#E7F8EF] px-3 py-1 text-xs font-medium text-[#526173]">
                      {notification.type}
                    </span>
                    {notification.status === "UNREAD" ? (
                      <span className="rounded-full bg-[#128C7E] px-3 py-1 text-xs font-medium text-white">
                        Unread
                      </span>
                    ) : null}
                  </div>

                  <h2 className="mt-3 text-lg font-semibold text-[#081B3A]">
                    {notification.title}
                  </h2>
                  <p className="mt-1 text-sm text-[#526173]">
                    {notification.message}
                  </p>
                  <p className="mt-2 text-xs text-[#526173]/80">
                    {notification.createdAt.toLocaleString("en-IN")}
                  </p>

                  {notification.actionHref ? (
                    <Link
                      href={notification.actionHref}
                      className="mt-4 inline-flex rounded-lg bg-[#128C7E] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#003D99]"
                    >
                      Open
                    </Link>
                  ) : null}
                </div>

                <NotificationActions
                  notificationId={notification.id}
                  isUnread={notification.status === "UNREAD"}
                />
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
