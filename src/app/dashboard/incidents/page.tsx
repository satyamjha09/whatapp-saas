import Link from "next/link";
import { requireAdmin } from "@/server/auth/authorization";
import { listIncidents } from "@/server/services/incident.service";

type IncidentsPageProps = {
  searchParams?: Promise<{
    status?: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  }>;
};

export default async function IncidentsPage({
  searchParams,
}: IncidentsPageProps) {
  const context = await requireAdmin();
  const params = await searchParams;

  const incidents = await listIncidents({
    companyId: context.membership.companyId,
    status: params?.status,
    take: 100,
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Operations</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">Incidents</h1>
        <p className="mt-2 text-sm text-gray-600">
          Track production issues, security events, webhook failures, and recovery work.
        </p>
      </div>

      <div className="mt-6 flex gap-2">
        {["OPEN", "ACKNOWLEDGED", "RESOLVED"].map((status) => (
          <Link
            key={status}
            href={`/dashboard/incidents?status=${status}`}
            className="rounded-full border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {status}
          </Link>
        ))}
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3">Incident</th>
              <th className="px-5 py-3">Severity</th>
              <th className="px-5 py-3">Source</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Opened</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {incidents.map((incident) => (
              <tr key={incident.id}>
                <td className="px-5 py-4">
                  <Link
                    href={`/dashboard/incidents/${incident.id}`}
                    className="font-semibold text-gray-900 hover:underline"
                  >
                    {incident.title}
                  </Link>
                  <p className="mt-1 line-clamp-1 text-xs text-gray-500">
                    {incident.description ?? "-"}
                  </p>
                </td>

                <td className="px-5 py-4">{incident.severity}</td>
                <td className="px-5 py-4">{incident.source}</td>
                <td className="px-5 py-4">{incident.status}</td>
                <td className="px-5 py-4">
                  {incident.openedAt.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
