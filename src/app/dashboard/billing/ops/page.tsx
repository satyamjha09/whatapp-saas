import { requireAdmin } from "@/server/auth/authorization";
import {
  listManualReviewCheckouts,
  listRecentPlanCheckouts,
} from "@/server/services/billing-ops.service";
import {
  ApproveManualReviewForm,
  RejectManualReviewForm,
} from "./manual-review-actions";

function money(paise: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(paise / 100);
}

export default async function BillingOpsPage() {
  const context = await requireAdmin();

  const [manualReviews, recentCheckouts] = await Promise.all([
    listManualReviewCheckouts({
      companyId: context.membership.companyId,
    }),
    listRecentPlanCheckouts({
      companyId: context.membership.companyId,
      take: 50,
    }),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Billing</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          Billing Ops
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Review payment reconciliation issues, manual checkouts, and plan upgrade status.
        </p>
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-yellow-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-yellow-900">
            Manual Payment Reviews
          </h2>
          <p className="mt-1 text-sm text-yellow-800">
            Only approve after matching Razorpay Dashboard order ID, payment ID,
            amount, and captured status.
          </p>
        </div>

        <div className="divide-y">
          {manualReviews.map((checkout) => (
            <article key={checkout.id} className="grid gap-5 px-6 py-5 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <p className="font-semibold text-gray-900">
                  {checkout.company.name} · {checkout.fromPlan} → {checkout.toPlan}
                </p>

                <p className="mt-1 text-sm text-gray-600">
                  Amount: {money(checkout.amountPaise, checkout.currency)}
                </p>

                <div className="mt-3 grid gap-1 text-xs text-gray-500">
                  <p>Checkout ID: {checkout.id}</p>
                  <p>Razorpay Order: {checkout.razorpayOrderId ?? "-"}</p>
                  <p>Razorpay Payment: {checkout.razorpayPaymentId ?? "-"}</p>
                  <p>Reason: {checkout.manualReviewReason ?? "-"}</p>
                  <p>Opened: {checkout.manualReviewOpenedAt?.toLocaleString() ?? "-"}</p>
                </div>

                {checkout.reconciliationEvents.length > 0 && (
                  <div className="mt-4 rounded-xl bg-gray-50 p-3">
                    <p className="text-xs font-semibold text-gray-700">
                      Latest reconciliation event
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                      {checkout.reconciliationEvents[0]?.message ??
                        checkout.reconciliationEvents[0]?.errorMessage ??
                        "-"}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <ApproveManualReviewForm checkoutId={checkout.id} />
                <RejectManualReviewForm checkoutId={checkout.id} />
              </div>
            </article>
          ))}

          {manualReviews.length === 0 && (
            <div className="px-6 py-10 text-center text-sm text-gray-500">
              No manual reviews pending.
            </div>
          )}
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Checkouts
          </h2>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Checkout</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Amount</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Payment</th>
                <th className="px-5 py-3">Created</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {recentCheckouts.map((checkout) => (
                <tr key={checkout.id}>
                  <td className="px-5 py-4 font-mono text-xs">{checkout.id}</td>
                  <td className="px-5 py-4">
                    {checkout.fromPlan} → {checkout.toPlan}
                  </td>
                  <td className="px-5 py-4">
                    {money(checkout.amountPaise, checkout.currency)}
                  </td>
                  <td className="px-5 py-4 font-semibold">{checkout.status}</td>
                  <td className="px-5 py-4 text-xs">
                    {checkout.razorpayPaymentId ?? "-"}
                  </td>
                  <td className="px-5 py-4">
                    {checkout.createdAt.toLocaleString()}
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
