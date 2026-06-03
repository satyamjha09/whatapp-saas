import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getAuditLogsByCompany } from "@/server/services/audit.service";

export default async function AuditLogsPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const logs = await getAuditLogsByCompany(context.membership.companyId);

  return (
    <main className="p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>

          <p className="mt-2 text-sm text-gray-600">
            Workspace: {context.membership.company.name}
          </p>
        </div>

        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">
            Latest Activity
          </h2>

          {logs.length === 0 ? (
            <p className="mt-6 rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
              No audit logs yet.
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-gray-500">
                    <th className="py-3 pr-4">Action</th>
                    <th className="py-3 pr-4">Actor</th>
                    <th className="py-3 pr-4">Entity</th>
                    <th className="py-3 pr-4">Metadata</th>
                    <th className="py-3 pr-4">Date</th>
                  </tr>
                </thead>

                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                          {log.action}
                        </span>
                      </td>

                      <td className="py-3 pr-4">
                        {log.actor?.email ?? "System"}
                      </td>

                      <td className="py-3 pr-4">{log.entityType}</td>

                      <td className="max-w-[360px] py-3 pr-4">
                        <pre className="overflow-x-auto rounded-lg bg-gray-50 p-2 text-xs text-gray-700">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </td>

                      <td className="py-3 pr-4 text-gray-600">
                        {log.createdAt.toLocaleString()}
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
