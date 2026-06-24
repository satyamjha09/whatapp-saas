import Link from "next/link";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import {
  getSubscriptionRenewalHealth,
  listCompanySubscriptionRenewalEvents,
} from "@/server/services/subscription-renewal.service";
import { ScanSubscriptionRenewalsButton } from "./renewal-actions";

export default async function SubscriptionRenewalsPage() {
  const context = await requireAuthenticatedWorkspace();

  const [health, events] = await Promise.all([
    getSubscriptionRenewalHealth(),
    listCompanySubscriptionRenewalEvents({
      companyId: context.membership.companyId,
    }),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Billing</p>
          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            Subscription Renewals
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Renewal reminders, past-due grace period, and auto downgrade
            history.
          </p>
        </div>

        <ScanSubscriptionRenewalsButton />
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Events / 24h</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {health.events24h}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Past Due Companies</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {health.pastDueCompanies}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Expiring 7 Days</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {health.paidCompaniesExpiring7d}
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Grace Days</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {health.graceDays}
          </p>
        </div>
      </section>

      {context.membership.company.subscriptionStatus === "PAST_DUE" && (
        <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5">
          <h2 className="font-semibold text-red-900">
            Your subscription is past due
          </h2>
          <p className="mt-1 text-sm text-red-800">
            Renew your plan before the grace period ends to avoid downgrade.
          </p>

          <Link
            href="/dashboard/billing/upgrade"
            className="mt-4 inline-flex rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Renew / Upgrade Plan
          </Link>
        </section>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Renewal Events
          </h2>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Period End</th>
                <th className="px-5 py-3">Message</th>
                <th className="px-5 py-3">Created</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {events.map((event) => (
                <tr key={event.id}>
                  <td className="px-5 py-4 font-semibold text-gray-900">
                    {event.type}
                  </td>
                  <td className="px-5 py-4">{event.status}</td>
                  <td className="px-5 py-4">{event.billingPlan}</td>
                  <td className="px-5 py-4">
                    {event.periodEnd?.toLocaleString() ?? "-"}
                  </td>
                  <td className="px-5 py-4">{event.message ?? "-"}</td>
                  <td className="px-5 py-4">
                    {event.createdAt.toLocaleString()}
                  </td>
                </tr>
              ))}

              {events.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-8 text-center text-sm text-gray-500"
                  >
                    No renewal events yet.
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
