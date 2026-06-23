import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import EmailDeliveryActions from "./email-delivery-actions";
import EmailMaintenanceButton from "./email-maintenance-button";
import RetryEmailDeliveryButton from "./retry-email-delivery-button";

export default async function NotificationEmailDeliveriesPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const [deliveries, pendingCount, sentCount, failedCount, skippedCount] =
    await Promise.all([
      prisma.companyNotificationEmailDelivery.findMany({
        where: {
          companyId: context.membership.companyId,
        },
        include: {
          notification: true,
          user: {
            select: {
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 100,
      }),
      prisma.companyNotificationEmailDelivery.count({
        where: {
          companyId: context.membership.companyId,
          status: "PENDING",
        },
      }),
      prisma.companyNotificationEmailDelivery.count({
        where: {
          companyId: context.membership.companyId,
          status: "SENT",
        },
      }),
      prisma.companyNotificationEmailDelivery.count({
        where: {
          companyId: context.membership.companyId,
          status: "FAILED",
        },
      }),
      prisma.companyNotificationEmailDelivery.count({
        where: {
          companyId: context.membership.companyId,
          status: "SKIPPED",
        },
      }),
    ]);

  return (
    <main className="p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Notification Email Deliveries
            </h1>

            <p className="mt-2 text-sm text-gray-600">
              Recent email alert delivery attempts for this workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-3">
            <EmailDeliveryActions />
            <EmailMaintenanceButton />
            <Link
              href="/dashboard/notifications"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
            >
              Back to Notifications
            </Link>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">
            SMTP Configuration
          </h2>

          <div className="mt-3 grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Email Alerts</p>
              <p className="mt-1 font-semibold text-gray-900">
                {process.env.NOTIFICATION_EMAILS_ENABLED === "true"
                  ? "Enabled"
                  : "Disabled"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">SMTP Host</p>
              <p className="mt-1 break-all font-semibold text-gray-900">
                {process.env.SMTP_HOST || "Not set"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">SMTP Port</p>
              <p className="mt-1 font-semibold text-gray-900">
                {process.env.SMTP_PORT || "587"}
              </p>
            </div>

            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">From</p>
              <p className="mt-1 break-all font-semibold text-gray-900">
                {process.env.SMTP_FROM || "Not set"}
              </p>
            </div>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="text-lg font-semibold text-blue-900">
            Email Delivery Retention
          </h2>

          <p className="mt-1 text-sm text-blue-800">
            Sent and skipped email delivery rows are kept for 90 days. Failed
            rows are kept for 180 days. Pending rows are never deleted by
            retention cleanup and stale pending deliveries are automatically
            re-queued.
          </p>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {pendingCount}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Sent</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {sentCount}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Failed</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {failedCount}
            </p>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Skipped</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {skippedCount}
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          {deliveries.length === 0 ? (
            <div className="p-8 text-sm text-gray-600">
              No email deliveries found.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Created</th>
                    <th className="px-6 py-3">To</th>
                    <th className="px-6 py-3">Notification</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Attempts</th>
                    <th className="px-6 py-3">Action URL</th>
                    <th className="px-6 py-3">Error</th>
                    <th className="px-6 py-3">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {deliveries.map((delivery) => (
                    <tr key={delivery.id}>
                      <td className="px-6 py-4">
                        {delivery.createdAt.toLocaleString()}
                      </td>

                      <td className="px-6 py-4">
                        {delivery.user.email ?? delivery.toEmail}
                      </td>

                      <td className="px-6 py-4 font-medium text-gray-900">
                        {delivery.notification.title}
                      </td>

                      <td className="px-6 py-4">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                          {delivery.status}
                        </span>
                      </td>

                      <td className="px-6 py-4">{delivery.attempts}</td>

                      <td className="max-w-md break-all px-6 py-4 text-gray-600">
                        {delivery.actionUrl ?? "-"}
                      </td>

                      <td className="max-w-md px-6 py-4 text-gray-600">
                        {delivery.lastError ?? "-"}
                      </td>

                      <td className="px-6 py-4">
                        <RetryEmailDeliveryButton
                          deliveryId={delivery.id}
                          disabled={delivery.status === "SENT"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
