import Link from "next/link";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import {
  getCompanyScheduledPlanChange,
  listCompanyScheduledPlanChanges,
} from "@/server/services/scheduled-plan-change.service";
import {
  CancelAtPeriodEndButton,
  DowngradeToFreeButton,
  UndoScheduledPlanChangeButton,
} from "./subscription-actions";

export default async function BillingSubscriptionPage() {
  const context = await requireAuthenticatedWorkspace();
  const company = context.membership.company;
  const canManage = ["OWNER", "ADMIN"].includes(context.membership.role);

  const [activeChange, history] = await Promise.all([
    getCompanyScheduledPlanChange({
      companyId: context.membership.companyId,
    }),
    listCompanyScheduledPlanChanges({
      companyId: context.membership.companyId,
    }),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Billing</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          Subscription
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage renewal, cancellation, and scheduled plan changes.
        </p>
      </div>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-sm text-gray-500">Current Plan</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {company.billingPlan}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {company.subscriptionStatus}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Period End</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {company.currentPeriodEnd?.toLocaleDateString() ?? "-"}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Message Limit</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {company.monthlyMessageLimit}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard/billing/upgrade"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Upgrade Plan
          </Link>

          {canManage && company.billingPlan !== "FREE" && !activeChange ? (
            <>
              <DowngradeToFreeButton />
              <CancelAtPeriodEndButton />
            </>
          ) : null}

          {canManage && activeChange ? <UndoScheduledPlanChangeButton /> : null}
        </div>
      </section>

      {activeChange ? (
        <section className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-6">
          <h2 className="text-lg font-semibold text-yellow-900">
            Scheduled plan change active
          </h2>

          <p className="mt-2 text-sm text-yellow-800">
            {activeChange.type}: {activeChange.fromPlan} -&gt;{" "}
            {activeChange.toPlan ?? "FREE"} on{" "}
            {activeChange.scheduledFor.toLocaleString()}.
          </p>

          <p className="mt-2 text-sm text-yellow-800">
            You will keep your current paid features until the scheduled date.
          </p>
        </section>
      ) : null}

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Scheduled Change History
          </h2>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">From</th>
                <th className="px-5 py-3">To</th>
                <th className="px-5 py-3">Scheduled</th>
                <th className="px-5 py-3">Requested By</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {history.map((change) => (
                <tr key={change.id}>
                  <td className="px-5 py-4 font-semibold text-gray-900">
                    {change.type}
                  </td>
                  <td className="px-5 py-4">{change.status}</td>
                  <td className="px-5 py-4">{change.fromPlan}</td>
                  <td className="px-5 py-4">{change.toPlan ?? "-"}</td>
                  <td className="px-5 py-4">
                    {change.scheduledFor.toLocaleString()}
                  </td>
                  <td className="px-5 py-4">
                    {change.requestedBy?.email ?? "-"}
                  </td>
                </tr>
              ))}

              {history.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-sm text-gray-500"
                  >
                    No scheduled plan changes yet.
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
