import Link from "next/link";
import { requireAdmin } from "@/server/auth/authorization";
import {
  getDefaultStatusPageForAdmin,
  getStatusPageHealth,
} from "@/server/services/status-page.service";

function componentClass(status: string) {
  if (status === "OPERATIONAL") return "bg-green-50 text-green-700 border-green-200";
  if (status === "DEGRADED") return "bg-yellow-50 text-yellow-700 border-yellow-200";
  if (status === "MAINTENANCE") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-red-50 text-red-700 border-red-200";
}

export default async function StatusPageAdminPage() {
  await requireAdmin();

  const [page, health] = await Promise.all([
    getDefaultStatusPageForAdmin(),
    getStatusPageHealth(),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">System</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            Public Status Page
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Customer-visible trust page for uptime, incidents, and maintenance.
          </p>
        </div>

        <Link
          href="/status"
          target="_blank"
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        >
          Open Public Page
        </Link>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Configured</p>
          <p className="mt-2 text-xl font-bold text-gray-900">
            {health.configured ? "Yes" : "No"}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Active Incidents</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {health.activeIncidents}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Degraded Components</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {health.degradedComponents}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Outage Components</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {health.outageComponents}
          </p>
        </div>
      </section>

      {!page ? (
        <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-gray-600">
            No status page found. Seed default settings and components:
          </p>
          <pre className="mt-3 rounded-xl bg-gray-950 p-4 text-sm text-white overflow-auto">
{`npm run status:seed`}
          </pre>
        </section>
      ) : (
        <>
          <section className="mt-6 rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b px-6 py-4 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">
                Components
              </h2>
            </div>

            <div className="divide-y divide-gray-100">
              {page.components.map((component) => (
                <div
                  key={component.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 hover:bg-gray-50/50"
                >
                  <div>
                    <p className="font-semibold text-gray-900">
                      {component.name}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {component.description ?? "-"}
                    </p>
                  </div>

                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${componentClass(
                      component.status,
                    )}`}
                  >
                    {component.status}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-2xl border bg-white shadow-sm overflow-hidden">
            <div className="border-b px-6 py-4 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">
                Incidents
              </h2>
            </div>

            <div className="divide-y divide-gray-100">
              {page.incidents.map((incident) => (
                <div key={incident.id} className="px-6 py-4 hover:bg-gray-50/50">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {incident.title}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Impact: <span className="font-semibold text-gray-700">{incident.impact}</span> · Status: <span className="font-semibold text-gray-700">{incident.status}</span> ·{" "}
                        {incident.startedAt.toLocaleString()}
                      </p>
                    </div>

                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                      incident.resolvedAt 
                        ? "bg-green-50 text-green-700 border-green-200" 
                        : "bg-gray-100 text-gray-700 border-gray-200"
                    }`}>
                      {incident.resolvedAt ? "Resolved" : "Active"}
                    </span>
                  </div>
                </div>
              ))}

              {page.incidents.length === 0 && (
                <p className="px-6 py-6 text-sm text-gray-500">
                  No incidents created yet.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
