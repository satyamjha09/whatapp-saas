import { requireAdmin } from "@/server/auth/authorization";
import {
  getDataRetentionHealth,
  listDataRetentionPolicies,
  listDataRetentionRuns,
  listLegalHolds,
} from "@/server/services/data-retention.service";
import {
  ReleaseLegalHoldButton,
  RunDataRetentionButton,
} from "./data-retention-actions";

export default async function DataRetentionPage() {
  await requireAdmin();

  const [health, policies, runs, legalHolds] = await Promise.all([
    getDataRetentionHealth(),
    listDataRetentionPolicies(),
    listDataRetentionRuns(),
    listLegalHolds(),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">System</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            Data Retention
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Automated cleanup policies, dry-run previews, and legal holds.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <RunDataRetentionButton dryRun />
          <RunDataRetentionButton dryRun={false} />
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        {[
          ["Active Policies", health.activePolicies],
          ["Dry Run", health.dryRun ? "Yes" : "No"],
          ["Failed Runs / 24h", health.failedRuns24h],
          ["Active Legal Holds", health.activeLegalHolds],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Policies</h2>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Entity</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Retention</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Last Run</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {policies.map((policy) => (
                <tr key={policy.id}>
                  <td className="px-5 py-4 font-semibold text-gray-900">
                    {policy.entityType}
                  </td>
                  <td className="px-5 py-4">{policy.status}</td>
                  <td className="px-5 py-4">{policy.retentionDays} days</td>
                  <td className="px-5 py-4">{policy.action}</td>
                  <td className="px-5 py-4">
                    {policy.lastRunAt?.toLocaleString() ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Recent Runs</h2>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Started</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Dry Run</th>
                <th className="px-5 py-3">Checked</th>
                <th className="px-5 py-3">Deleted</th>
                <th className="px-5 py-3">Skipped</th>
                <th className="px-5 py-3">Failed</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="px-5 py-4">{run.startedAt.toLocaleString()}</td>
                  <td className="px-5 py-4">{run.status}</td>
                  <td className="px-5 py-4">{run.dryRun ? "Yes" : "No"}</td>
                  <td className="px-5 py-4">{run.checkedCount}</td>
                  <td className="px-5 py-4">{run.deletedCount}</td>
                  <td className="px-5 py-4">{run.skippedCount}</td>
                  <td className="px-5 py-4">{run.failedCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Legal Holds</h2>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Entity</th>
                <th className="px-5 py-3">Reason</th>
                <th className="px-5 py-3">Active</th>
                <th className="px-5 py-3">Created</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {legalHolds.map((hold) => (
                <tr key={hold.id}>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-gray-900">
                      {hold.entityType}
                    </p>
                    <p className="font-mono text-xs text-gray-500">
                      {hold.entityId}
                    </p>
                  </td>
                  <td className="px-5 py-4">{hold.reason}</td>
                  <td className="px-5 py-4">{hold.active ? "Yes" : "No"}</td>
                  <td className="px-5 py-4">{hold.createdAt.toLocaleString()}</td>
                  <td className="px-5 py-4">
                    {hold.active ? (
                      <ReleaseLegalHoldButton legalHoldId={hold.id} />
                    ) : null}
                  </td>
                </tr>
              ))}

              {legalHolds.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-gray-500">
                    No legal holds.
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
