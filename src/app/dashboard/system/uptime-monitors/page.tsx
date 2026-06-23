import Link from "next/link";
import { requireAdmin } from "@/server/auth/authorization";
import {
  getUptimeMonitoringHealth,
  listUptimeMonitors,
} from "@/server/services/uptime-monitoring.service";
import { RunUptimeCheckButton } from "./uptime-monitor-actions";

function statusClass(status?: string | null) {
  if (status === "UP") return "bg-green-50 text-green-700";
  if (status === "DEGRADED") return "bg-yellow-50 text-yellow-700";
  if (status === "DOWN") return "bg-red-50 text-red-700";
  return "bg-gray-100 text-gray-700";
}

export default async function UptimeMonitorsPage() {
  await requireAdmin();

  const [health, monitors] = await Promise.all([
    getUptimeMonitoringHealth(),
    listUptimeMonitors(),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">System</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          Uptime Monitors
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Monitor public URLs, health endpoints, latency, and downtime incidents.
        </p>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Active Monitors</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {health.activeMonitors}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Down</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {health.downMonitors}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Checks / 24h</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {health.checks24h}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Open Incidents</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {health.openIncidentMonitors}
          </p>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Monitors</h2>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Monitor</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Latency</th>
                <th className="px-5 py-3">Failures</th>
                <th className="px-5 py-3">Last Checked</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {monitors.map((monitor) => (
                <tr key={monitor.id}>
                  <td className="px-5 py-4">
                    <Link
                      href={`/dashboard/system/uptime-monitors/${monitor.id}`}
                      className="font-semibold text-gray-900 hover:underline"
                    >
                      {monitor.name}
                    </Link>
                    <p className="mt-1 max-w-md truncate text-xs text-gray-500">
                      {monitor.url}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(
                        monitor.lastStatus,
                      )}`}
                    >
                      {monitor.lastStatus ?? "UNKNOWN"}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    {monitor.lastStatusCode ?? "-"}
                  </td>

                  <td className="px-5 py-4">
                    {monitor.lastLatencyMs ? `${monitor.lastLatencyMs}ms` : "-"}
                  </td>

                  <td className="px-5 py-4">
                    {monitor.consecutiveFailures}
                  </td>

                  <td className="px-5 py-4">
                    {monitor.lastCheckedAt?.toLocaleString() ?? "-"}
                  </td>

                  <td className="px-5 py-4">
                    <RunUptimeCheckButton monitorId={monitor.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
