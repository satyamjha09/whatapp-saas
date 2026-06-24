import { Download } from "lucide-react";
import { requireAdmin } from "@/server/auth/authorization";
import {
  getComplianceEvidenceConfig,
  getComplianceEvidenceHealth,
  listComplianceEvidenceExports,
} from "@/server/services/compliance-evidence.service";
import {
  CreateEvidenceExportForm,
  ProcessEvidenceExportButton,
} from "./evidence-actions";

function statusClass(status: string) {
  if (status === "COMPLETED") return "bg-green-50 text-green-700";
  if (status === "FAILED") return "bg-red-50 text-red-700";
  if (status === "EXPIRED") return "bg-gray-100 text-gray-600";
  return "bg-yellow-50 text-yellow-700";
}

export default async function ComplianceEvidencePage() {
  const context = await requireAdmin();
  const now = new Date();
  const dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [health, exports] = await Promise.all([
    getComplianceEvidenceHealth(),
    listComplianceEvidenceExports({
      companyId: context.membership.companyId,
    }),
  ]);
  const config = getComplianceEvidenceConfig();

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">System</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          Compliance Evidence Center
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Generate downloadable evidence packs for audits, legal review, and enterprise customers.
        </p>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        {[
          ["Pending", health.pending],
          ["Completed / 24h", health.completed24h],
          ["Failed / 24h", health.failed24h],
          ["Expired Files", health.expiredFiles],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Create Evidence Export
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Range limit: {config.maxRangeDays} days. Files expire after{" "}
              {config.exportTtlHours} hours.
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              config.enabled ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}
          >
            {config.enabled ? "Enabled" : "Disabled"}
          </span>
        </div>

        <CreateEvidenceExportForm
          initialDateFrom={dateFrom.toISOString()}
          initialDateTo={now.toISOString()}
        />
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Evidence Exports
          </h2>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Range</th>
                <th className="px-5 py-3">Requested By</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {exports.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-4 font-semibold text-gray-900">
                    {item.type}
                    {item.contact ? (
                      <p className="mt-1 text-xs text-gray-500">
                        Contact: {item.contact.name ?? item.contact.phoneNumber}
                      </p>
                    ) : null}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass(
                        item.status,
                      )}`}
                    >
                      {item.status}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <p>{item.dateFrom.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">
                      to {item.dateTo.toLocaleString()}
                    </p>
                  </td>

                  <td className="px-5 py-4">
                    {item.requestedBy?.email ?? "-"}
                  </td>

                  <td className="px-5 py-4">
                    {item.createdAt.toLocaleString()}
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      {["PENDING", "FAILED"].includes(item.status) ? (
                        <ProcessEvidenceExportButton exportId={item.id} />
                      ) : null}

                      {item.status === "COMPLETED" && item.fileName ? (
                        <a
                          href={`/api/system/compliance/evidence-exports/${item.id}/download`}
                          className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
                      ) : null}
                    </div>

                    {item.failureReason ? (
                      <p className="mt-2 max-w-xs text-xs text-red-600">
                        {item.failureReason}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}

              {exports.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-sm text-gray-500"
                  >
                    No evidence exports yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
