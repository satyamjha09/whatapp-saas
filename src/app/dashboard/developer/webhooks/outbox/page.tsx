import Link from "next/link";
import { redirect } from "next/navigation";
import PlanFeatureLockCard from "@/app/dashboard/_components/plan-feature-lock-card";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { hasCompanyFeature } from "@/server/services/feature-gate.service";

export default async function DeveloperWebhookOutboxPage() {
  const context = await getCurrentWorkspaceContext();
  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const companyId = context.membership.companyId;
  const canUseDeveloperWebhooks = await hasCompanyFeature(
    companyId,
    "DEVELOPER_WEBHOOKS",
  );

  if (!canUseDeveloperWebhooks) {
    return (
      <main className="p-8">
        <div className="mx-auto max-w-4xl">
          <PlanFeatureLockCard
            title="Webhook Outbox is locked"
            description="Upgrade to Growth or higher to use developer webhook diagnostics."
            requiredPlan="Growth"
          />
        </div>
      </main>
    );
  }

  const [events, pendingCount, processingCount, deliveredCount, failedCount] =
    await Promise.all([
      prisma.developerWebhookOutbox.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.developerWebhookOutbox.count({
        where: { companyId, status: "PENDING" },
      }),
      prisma.developerWebhookOutbox.count({
        where: { companyId, status: "PROCESSING" },
      }),
      prisma.developerWebhookOutbox.count({
        where: { companyId, status: "DELIVERED" },
      }),
      prisma.developerWebhookOutbox.count({
        where: { companyId, status: "FAILED" },
      }),
    ]);

  const summaries = [
    ["Pending", pendingCount],
    ["Processing", processingCount],
    ["Delivered", deliveredCount],
    ["Failed", failedCount],
  ] as const;

  return (
    <main className="p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Webhook Outbox</h1>
            <p className="mt-2 text-sm text-gray-600">
              Track durable events before they are published to subscribed
              endpoints.
            </p>
          </div>
          <Link
            href="/dashboard/developer/webhooks"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
          >
            Back to Webhooks
          </Link>
        </div>

        <section className="mb-6 grid gap-4 sm:grid-cols-4">
          {summaries.map(([label, count]) => (
            <div key={label} className="rounded-2xl border bg-white p-5 shadow-sm">
              <p className="text-sm text-gray-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{count}</p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Events</h2>
          </div>
          {events.length === 0 ? (
            <div className="p-8 text-sm text-gray-600">
              No webhook outbox events found.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Created</th>
                    <th className="px-6 py-3">Event</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Attempts</th>
                    <th className="px-6 py-3">Idempotency</th>
                    <th className="px-6 py-3">Error</th>
                    <th className="px-6 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td className="whitespace-nowrap px-6 py-4">
                        {event.createdAt.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">
                        <Link
                          href={`/dashboard/developer/webhooks/outbox/${event.id}`}
                          className="hover:text-[#0052CC] hover:underline"
                        >
                          {event.eventType}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                          {event.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">{event.attempts}</td>
                      <td className="max-w-xs truncate px-6 py-4 font-mono text-xs text-gray-500">
                        {event.idempotencyKey ?? "-"}
                      </td>
                      <td className="max-w-md px-6 py-4 text-gray-600">
                        {event.lastError ?? "-"}
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/dashboard/developer/webhooks/outbox/${event.id}`}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700"
                        >
                          View
                        </Link>
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
