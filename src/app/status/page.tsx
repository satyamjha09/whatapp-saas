import { notFound } from "next/navigation";
import { getPublicStatusPage } from "@/server/services/status-page.service";

function componentClass(status: string) {
  if (status === "OPERATIONAL") return "bg-green-50 text-green-700 border-green-200";
  if (status === "DEGRADED") return "bg-yellow-50 text-yellow-700 border-yellow-200";
  if (status === "MAINTENANCE") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-red-50 text-red-700 border-red-200";
}

function overallStatus(components: Array<{ status: string }>) {
  if (components.some((item) => item.status === "MAJOR_OUTAGE")) {
    return {
      label: "Major outage",
      className: "bg-red-50 text-red-700 border-red-100",
    };
  }

  if (components.some((item) => item.status === "PARTIAL_OUTAGE")) {
    return {
      label: "Partial outage",
      className: "bg-red-50 text-red-700 border-red-100",
    };
  }

  if (components.some((item) => item.status === "DEGRADED")) {
    return {
      label: "Degraded performance",
      className: "bg-yellow-50 text-yellow-700 border-yellow-100",
    };
  }

  if (components.some((item) => item.status === "MAINTENANCE")) {
    return {
      label: "Maintenance in progress",
      className: "bg-blue-50 text-blue-700 border-blue-100",
    };
  }

  return {
    label: "All Systems Operational",
    className: "bg-green-50 text-green-700 border-green-100",
  };
}

export default async function PublicStatusPage() {
  const page = await getPublicStatusPage();

  if (!page) {
    notFound();
  }

  const status = overallStatus(page.components);

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">System Status</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900">
              {page.name}
            </h1>
            {page.description && (
              <p className="mt-2 text-sm text-gray-600">{page.description}</p>
            )}
          </div>
        </header>

        <section className={`mt-8 rounded-2xl border p-6 shadow-sm ${status.className}`}>
          <h2 className="text-xl font-bold tracking-tight">{status.label}</h2>
          <p className="mt-1 text-xs opacity-80">
            Last updated {new Date().toLocaleString()}
          </p>
        </section>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-6 py-4 bg-gray-50">
            <h2 className="text-base font-semibold text-gray-900">Components</h2>
          </div>

          <div className="divide-y divide-gray-100">
            {page.components.map((component) => (
              <div
                key={component.id}
                className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    {component.name}
                  </p>
                  {component.description && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      {component.description}
                    </p>
                  )}
                </div>

                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${componentClass(
                    component.status,
                  )}`}
                >
                  {component.status.replaceAll("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="border-b border-gray-100 px-6 py-4 bg-gray-50">
            <h2 className="text-base font-semibold text-gray-900">
              Recent Incidents
            </h2>
          </div>

          <div className="divide-y divide-gray-100">
            {page.incidents.length === 0 ? (
              <p className="px-6 py-6 text-sm text-gray-500">
                No recent incidents reported. All services running smoothly.
              </p>
            ) : (
              page.incidents.map((incident) => (
                <article key={incident.id} className="px-6 py-5 hover:bg-gray-50/50 transition-colors">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {incident.title}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Impact: <span className="font-semibold text-gray-700">{incident.impact}</span> · Status: <span className="font-semibold text-gray-700">{incident.status}</span> ·{" "}
                        {incident.startedAt.toLocaleString()}
                      </p>
                    </div>

                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      incident.resolvedAt 
                        ? "bg-green-50 text-green-700 border border-green-200" 
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}>
                      {incident.resolvedAt ? "Resolved" : "Active"}
                    </span>
                  </div>

                  {incident.body && (
                    <p className="mt-3 text-sm text-gray-700 leading-relaxed">
                      {incident.body}
                    </p>
                  )}

                  <div className="mt-4 space-y-3">
                    {incident.updates.map((update) => (
                      <div key={update.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                          Update: {update.status.replaceAll("_", " ")}
                        </p>
                        <p className="mt-1 text-sm text-gray-700 leading-relaxed">
                          {update.message}
                        </p>
                        <p className="mt-2 text-xs text-gray-400">
                          {update.createdAt.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {page.supportEmail && (
          <footer className="mt-12 text-center text-xs text-gray-500">
            Need assistance? Contact{" "}
            <a
              href={`mailto:${page.supportEmail}`}
              className="font-medium text-gray-950 underline hover:text-gray-900"
            >
              {page.supportEmail}
            </a>
          </footer>
        )}
      </div>
    </main>
  );
}
