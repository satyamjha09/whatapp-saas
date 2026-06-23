import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/auth/authorization";
import { getBillingReconciliationRun } from "@/server/services/billing-reconciliation.service";

type PageProps = {
  params: Promise<{ runId: string }>;
};

function formatPaise(value?: number | null) {
  if (typeof value !== "number") return "-";
  return `₹${(value / 100).toFixed(2)}`;
}

export default async function BillingReconciliationRunPage({ params }: PageProps) {
  await requireAdmin();

  const { runId } = await params;
  const run = await getBillingReconciliationRun(runId);
  if (!run) notFound();

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <Link
        href="/dashboard/system/billing-reconciliation"
        className="text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        ← Back to reconciliation
      </Link>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">Reconciliation Run</p>
        <h1 className="mt-1 font-mono text-2xl font-bold text-gray-900">{run.id}</h1>
        {run.errorMessage && <p className="mt-3 text-sm text-red-600">{run.errorMessage}</p>}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            ["Status", run.status],
            ["Companies", run.checkedCompanies],
            ["Ledgers", run.checkedLedgers],
            ["Issues", run.issueCount],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-gray-50 p-4">
              <p className="text-sm text-gray-500">{label}</p>
              <p className="mt-1 font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Issues</h2>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Severity</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Expected</th>
                <th className="px-5 py-3">Actual</th>
                <th className="px-5 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {run.issues.map((issue) => (
                <tr key={issue.id} className="align-top">
                  <td className="px-5 py-4 font-medium">{issue.severity}</td>
                  <td className="px-5 py-4 text-xs">{issue.type}</td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-gray-900">{issue.title}</p>
                    <p className="mt-1 max-w-xl text-xs text-gray-500">{issue.description ?? "-"}</p>
                  </td>
                  <td className="px-5 py-4">{formatPaise(issue.expectedAmountPaise)}</td>
                  <td className="px-5 py-4">{formatPaise(issue.actualAmountPaise)}</td>
                  <td className="whitespace-nowrap px-5 py-4">{issue.createdAt.toLocaleString()}</td>
                </tr>
              ))}
              {run.issues.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-500">No reconciliation issues found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
