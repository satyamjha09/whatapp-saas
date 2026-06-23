import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth/authorization";
import { getUptimeMonitorDetail } from "@/server/services/uptime-monitoring.service";
import { RunUptimeCheckButton } from "../uptime-monitor-actions";

type PageProps = {
  params: Promise<{
    monitorId: string;
  }>;
};

function statusClass(status: string) {
  if (status === "UP") return "bg-green-50 text-green-700";
  if (status === "DEGRADED") return "bg-yellow-50 text-yellow-700";
  if (status === "DOWN") return "bg-red-50 text-red-700";
  return "bg-gray-100 text-gray-700";
}

export default async function UptimeMonitorDetailPage({ params }: PageProps) {
  await requireAdmin();

  const { monitorId } = await params;
  const monitor = await getUptimeMonitorDetail(monitorId);

  if (!monitor) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <Link
        href="/dashboard/system/uptime-monitors"
        className="text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        ← Back to uptime monitors
      </Link>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">
              {monitor.method} · Expected {monitor.expectedStatus}
            </p>
            <h1 className="mt-1 text-3xl font-bold text-gray-900">
              {monitor.name}
            </h1>
            <p className="mt-2 break-all text-sm text-gray-600">
              {monitor.url}
            </p>
          </div>

          <RunUptimeCheckButton monitorId={monitor.id} />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-5">
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Last Status</p>
            <p className="mt-1 font-semibold text-gray-900">
              {monitor.lastStatus ?? "UNKNOWN"}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Latency</p>
            <p className="mt-1 font-semibold text-gray-900">
              {monitor.lastLatencyMs ? `${monitor.lastLatencyMs}ms` : "-"}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Failures</p>
            <p className="mt-1 font-semibold text-gray-900">
              {monitor.consecutiveFailures}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Successes</p>
            <p className="mt-1 font-semibold text-gray-900">
              {monitor.consecutiveSuccesses}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Incident</p>
            <p className="mt-1 font-semibold text-gray-900">
              {monitor.openIncidentState ?? "-"}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Checks
          </h2>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Code</th>
              <th className="px-5 py-3">Latency</th>
              <th className="px-5 py-3">Error</th>
              <th className="px-5 py-3">Checked</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {monitor.checks.map((check) => (
              <tr key={check.id}>
                <td className="px-5 py-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(
                      check.status,
                    )}`}
                  >
                    {check.status}
                  </span>
                </td>

                <td className="px-5 py-4">{check.statusCode ?? "-"}</td>

                <td className="px-5 py-4">
                  {check.latencyMs ? `${check.latencyMs}ms` : "-"}
                </td>

                <td className="max-w-lg px-5 py-4">
                  <p className="line-clamp-2 text-xs text-red-600">
                    {check.errorMessage ?? "-"}
                  </p>
                </td>

                <td className="px-5 py-4">
                  {check.checkedAt.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
