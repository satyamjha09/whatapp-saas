import Link from "next/link";
import { requireAdmin } from "@/server/auth/authorization";
import {
  getBillingReconciliationHealth,
  listBillingReconciliationRuns,
} from "@/server/services/billing-reconciliation.service";
import RunReconciliationButton from "./run-reconciliation-button";

export default async function BillingReconciliationPage() {
  await requireAdmin();

  const [health, runs] = await Promise.all([
    getBillingReconciliationHealth(),
    listBillingReconciliationRuns(),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">System</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            Billing Reconciliation
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Verifies wallet balances, usage ledgers, and wallet transactions.
          </p>
        </div>
        <RunReconciliationButton />
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {[
          ["Status", health.isHealthy ? "Healthy" : "Needs Review"],
          ["Critical Issues", health.unresolvedCritical],
          ["High Issues", health.unresolvedHigh],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Reconciliation Runs</h2>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Run</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Companies</th>
                <th className="px-5 py-3">Ledgers</th>
                <th className="px-5 py-3">Issues</th>
                <th className="px-5 py-3">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="px-5 py-4">
                    <Link
                      href={`/dashboard/system/billing-reconciliation/${run.id}`}
                      className="font-mono text-xs font-semibold text-gray-900 hover:underline"
                    >
                      {run.id}
                    </Link>
                  </td>
                  <td className="px-5 py-4">{run.status}</td>
                  <td className="px-5 py-4">{run.checkedCompanies}</td>
                  <td className="px-5 py-4">{run.checkedLedgers}</td>
                  <td className="px-5 py-4">{run.issueCount}</td>
                  <td className="whitespace-nowrap px-5 py-4">{run.startedAt.toLocaleString()}</td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">Reconciliation has not run yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
