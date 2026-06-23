import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getSecurityEventById } from "@/server/services/security-event.service";
import SecurityEventActions from "./security-event-actions";

type SecurityEventPageProps = {
  params: Promise<{
    eventId: string;
  }>;
};

function formatJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default async function SecurityEventPage({
  params,
}: SecurityEventPageProps) {
  const context = await getCurrentWorkspaceContext();

  if (!context?.membership) {
    notFound();
  }

  const { eventId } = await params;

  const event = await getSecurityEventById({
    eventId,
  });

  if (!event) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link
        href="/dashboard/system/health"
        className="text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        ← Back to System Health
      </Link>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Security Event
              </h1>

              <p className="mt-1 text-sm text-gray-600">{event.summary}</p>
            </div>

            <div className="flex gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  event.severity === "CRITICAL" || event.severity === "HIGH"
                    ? "bg-red-50 text-red-700"
                    : event.severity === "MEDIUM"
                      ? "bg-yellow-50 text-yellow-700"
                      : "bg-green-50 text-green-700"
                }`}
              >
                {event.severity}
              </span>

              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  event.resolvedAt
                    ? "bg-green-50 text-green-700"
                    : "bg-yellow-50 text-yellow-700"
                }`}
              >
                {event.resolvedAt ? "Resolved" : "Open"}
              </span>
            </div>
          </div>

          <dl className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <dt className="text-sm text-gray-500">Type</dt>
              <dd className="font-medium text-gray-900">{event.type}</dd>
            </div>

            <div>
              <dt className="text-sm text-gray-500">Source</dt>
              <dd className="font-medium text-gray-900">{event.source}</dd>
            </div>

            <div>
              <dt className="text-sm text-gray-500">Path</dt>
              <dd className="break-all font-medium text-gray-900">
                {event.path ?? "-"}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-gray-500">Method</dt>
              <dd className="font-medium text-gray-900">
                {event.method ?? "-"}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-gray-500">IP Address</dt>
              <dd className="font-medium text-gray-900">
                {event.ipAddress ?? "-"}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-gray-500">User Agent</dt>
              <dd className="break-all font-medium text-gray-900">
                {event.userAgent ?? "-"}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-gray-500">Created</dt>
              <dd className="font-medium text-gray-900">
                {event.createdAt.toLocaleString()}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-gray-500">Resolved</dt>
              <dd className="font-medium text-gray-900">
                {event.resolvedAt ? event.resolvedAt.toLocaleString() : "-"}
              </dd>
            </div>
          </dl>

          {event.resolutionNote && (
            <div className="mt-6 rounded-xl bg-green-50 p-4">
              <p className="text-sm font-semibold text-green-800">
                Resolution Note
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-green-700">
                {event.resolutionNote}
              </p>
            </div>
          )}
        </section>

        <SecurityEventActions
          eventId={event.id}
          isResolved={Boolean(event.resolvedAt)}
        />
      </div>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Metadata</h2>

        <pre className="mt-4 max-h-[520px] overflow-auto rounded-xl bg-gray-950 p-4 text-xs text-gray-100">
          {formatJson(event.metadata)}
        </pre>
      </section>
    </main>
  );
}
