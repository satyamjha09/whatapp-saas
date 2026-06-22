import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PlanFeatureLockCard from "@/app/dashboard/_components/plan-feature-lock-card";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getDeveloperWebhookOutboxEventDetail } from "@/server/services/developer-webhook-outbox-detail.service";
import { hasCompanyFeature } from "@/server/services/feature-gate.service";
import RetryOutboxEventButton from "../retry-outbox-event-button";
import CopyJsonButton from "./copy-json-button";
import JsonViewer from "./json-viewer";

function statusBadgeClass(status: string) {
  if (status === "DELIVERED") return "bg-green-50 text-green-700";
  if (status === "FAILED") return "bg-red-50 text-red-700";
  if (status === "PROCESSING" || status === "PENDING") {
    return "bg-yellow-50 text-yellow-700";
  }
  return "bg-gray-100 text-gray-700";
}

export default async function WebhookOutboxDetailPage({
  params,
}: {
  params: Promise<{ outboxEventId: string }>;
}) {
  const context = await getCurrentWorkspaceContext();
  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const canUseDeveloperWebhooks = await hasCompanyFeature(
    context.membership.companyId,
    "DEVELOPER_WEBHOOKS",
  );
  if (!canUseDeveloperWebhooks) {
    return (
      <main className="p-8">
        <div className="mx-auto max-w-4xl">
          <PlanFeatureLockCard
            title="Webhook Outbox is locked"
            description="Upgrade to Growth or higher to inspect webhook outbox events."
            requiredPlan="Growth"
          />
        </div>
      </main>
    );
  }

  const { outboxEventId } = await params;
  const event = await getDeveloperWebhookOutboxEventDetail({
    companyId: context.membership.companyId,
    outboxEventId,
  });
  if (!event) notFound();

  return (
    <main className="p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Webhook Outbox Event
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Inspect payload, processing status, and endpoint deliveries.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <RetryOutboxEventButton
              outboxEventId={event.id}
              disabled={
                event.status === "DELIVERED" || event.status === "PROCESSING"
              }
            />
            <Link
              href="/dashboard/developer/webhooks/outbox"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700"
            >
              Back to Outbox
            </Link>
          </div>
        </div>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Event Type</p>
            <p className="mt-1 break-all text-lg font-semibold text-gray-900">
              {event.eventType}
            </p>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Status</p>
            <span
              className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(event.status)}`}
            >
              {event.status}
            </span>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Attempts</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {event.attempts}
            </p>
          </div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Created</p>
            <p className="mt-1 text-sm font-medium text-gray-900">
              {event.createdAt.toLocaleString()}
            </p>
          </div>
        </section>

        {event.lastError && (
          <section className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
            <h2 className="text-lg font-semibold text-red-800">Last Error</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm text-red-700">
              {event.lastError}
            </p>
          </section>
        )}

        <section className="mb-6 rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Outbox Payload
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                The durable event payload used for webhook delivery.
              </p>
            </div>
            <CopyJsonButton value={event.payload} />
          </div>
          <div className="mt-5">
            <JsonViewer value={event.payload} />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Delivery Timeline
            </h2>
          </div>
          {event.deliveries.length === 0 ? (
            <div className="p-8 text-sm text-gray-600">
              No endpoint deliveries found for this event yet.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-6 py-3">Time</th>
                    <th className="px-6 py-3">Webhook</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Attempts</th>
                    <th className="px-6 py-3">Code</th>
                    <th className="px-6 py-3">Duration</th>
                    <th className="px-6 py-3">Response / Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {event.deliveries.map((delivery) => (
                    <tr key={delivery.id}>
                      <td className="whitespace-nowrap px-6 py-4">
                        {delivery.createdAt.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">
                          {delivery.endpoint.name}
                        </p>
                        <p className="mt-1 max-w-xs break-all text-xs text-gray-500">
                          {delivery.endpoint.url}
                        </p>
                        {delivery.endpoint.autoDisabledAt && (
                          <p className="mt-1 text-xs text-red-600">
                            Auto-disabled
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${statusBadgeClass(delivery.status)}`}
                        >
                          {delivery.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">{delivery.attempts}</td>
                      <td className="px-6 py-4">
                        {delivery.responseStatus ?? "-"}
                      </td>
                      <td className="px-6 py-4">
                        {delivery.durationMs !== null
                          ? `${delivery.durationMs}ms`
                          : "-"}
                      </td>
                      <td className="max-w-lg px-6 py-4 text-gray-600">
                        {delivery.responseBody ? (
                          <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-2 text-xs">
                            {delivery.responseBody}
                          </pre>
                        ) : (
                          delivery.lastError ?? "-"
                        )}
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
