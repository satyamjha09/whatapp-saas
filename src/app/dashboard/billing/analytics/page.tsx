import { requireAdmin } from "@/server/auth/authorization";
import { getBillingAnalyticsDashboard } from "@/server/services/billing-analytics.service";
import { GenerateBillingSnapshotButton } from "./analytics-actions";

function money(paise: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(paise / 100);
}

export default async function BillingAnalyticsPage() {
  await requireAdmin();

  const dashboard = await getBillingAnalyticsDashboard();
  const metrics = dashboard.currentMetrics;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Billing</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            Billing Analytics
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Revenue, refunds, MRR, ARR, paid companies, and plan distribution.
          </p>
        </div>

        <GenerateBillingSnapshotButton />
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Gross Revenue</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {money(metrics.grossRevenuePaise, metrics.currency)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Last {dashboard.windowDays} days
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Refunds</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {money(metrics.refundPaise, metrics.currency)}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Net Revenue</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {money(metrics.netRevenuePaise, metrics.currency)}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">MRR</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {money(metrics.mrrPaise, metrics.currency)}
          </p>
        </div>
      </section>

      <section className="mt-4 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">ARR</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {money(metrics.arrPaise, metrics.currency)}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Paid Companies</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {metrics.paidCompanies}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Free Companies</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {metrics.freeCompanies}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Past Due</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {metrics.pastDueCompanies}
          </p>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">
          Plan Distribution
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Starter</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {metrics.starterCompanies}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Growth</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {metrics.growthCompanies}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Business</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {metrics.businessCompanies}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Active Total</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {metrics.activeCompanies}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Daily Snapshots
          </h2>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Gross</th>
                <th className="px-5 py-3">Refunds</th>
                <th className="px-5 py-3">Net</th>
                <th className="px-5 py-3">MRR</th>
                <th className="px-5 py-3">Paid Companies</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {dashboard.dailySnapshots.map((snapshot) => (
                <tr key={snapshot.id}>
                  <td className="px-5 py-4">
                    {snapshot.periodStart.toLocaleDateString()}
                  </td>
                  <td className="px-5 py-4">
                    {money(snapshot.grossRevenuePaise, snapshot.currency)}
                  </td>
                  <td className="px-5 py-4">
                    {money(snapshot.refundPaise, snapshot.currency)}
                  </td>
                  <td className="px-5 py-4 font-semibold">
                    {money(snapshot.netRevenuePaise, snapshot.currency)}
                  </td>
                  <td className="px-5 py-4">
                    {money(snapshot.mrrPaise, snapshot.currency)}
                  </td>
                  <td className="px-5 py-4">{snapshot.paidCompanies}</td>
                </tr>
              ))}

              {dashboard.dailySnapshots.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-sm text-gray-500"
                  >
                    No daily snapshots yet. Click Generate Snapshot.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
