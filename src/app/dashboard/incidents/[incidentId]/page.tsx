import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth/authorization";
import { getIncidentById } from "@/server/services/incident.service";
import IncidentActions from "./incident-actions";

type IncidentDetailPageProps = {
  params: Promise<{
    incidentId: string;
  }>;
};

export default async function IncidentDetailPage({
  params,
}: IncidentDetailPageProps) {
  const context = await requireAdmin();
  const { incidentId } = await params;

  const incident = await getIncidentById({
    incidentId,
    companyId: context.membership.companyId,
  });

  if (!incident) {
    notFound();
  }

  const incidentMetadata =
    incident.metadata &&
    typeof incident.metadata === "object" &&
    !Array.isArray(incident.metadata)
      ? incident.metadata
      : null;
  const deadLetterQueueHref =
    incidentMetadata &&
    typeof incidentMetadata.deadLetterQueueHref === "string" &&
    incidentMetadata.deadLetterQueueHref.startsWith(
      "/dashboard/system/dead-letter-queue",
    )
      ? incidentMetadata.deadLetterQueueHref
      : null;
  const billingReconciliationHref =
    incidentMetadata &&
    typeof incidentMetadata.billingReconciliationHref === "string" &&
    incidentMetadata.billingReconciliationHref.startsWith(
      "/dashboard/system/billing-reconciliation/",
    )
      ? incidentMetadata.billingReconciliationHref
      : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href="/dashboard/incidents"
        className="text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        ← Back to incidents
      </Link>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">
              {incident.source} · {incident.severity}
            </p>

            <h1 className="mt-1 text-3xl font-bold text-gray-900">
              {incident.title}
            </h1>

            <p className="mt-2 text-sm text-gray-600">
              {incident.description ?? "No description."}
            </p>
          </div>

          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            {incident.status}
          </span>
        </div>

        <div className="mt-6">
          <IncidentActions incidentId={incident.id} status={incident.status} />
        </div>

        {deadLetterQueueHref && (
          <div className="mt-4">
            <Link
              href={deadLetterQueueHref}
              className="text-sm font-medium text-gray-900 underline"
            >
              Inspect linked failed jobs
            </Link>
          </div>
        )}

        {billingReconciliationHref && (
          <div className="mt-4">
            <Link
              href={billingReconciliationHref}
              className="text-sm font-medium text-gray-900 underline"
            >
              Inspect billing reconciliation issues
            </Link>
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Opened</p>
            <p className="mt-1 font-medium text-gray-900">
              {incident.openedAt.toLocaleString()}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Acknowledged</p>
            <p className="mt-1 font-medium text-gray-900">
              {incident.acknowledgedAt?.toLocaleString() ?? "-"}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Resolved</p>
            <p className="mt-1 font-medium text-gray-900">
              {incident.resolvedAt?.toLocaleString() ?? "-"}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Timeline</h2>

        <div className="mt-4 space-y-3">
          {incident.timeline.map((item) => (
            <div key={item.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <p className="font-semibold text-gray-900">{item.type}</p>
                <p className="text-xs text-gray-500">
                  {item.createdAt.toLocaleString()}
                </p>
              </div>

              <p className="mt-1 text-sm text-gray-600">
                {item.message ?? "-"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
