import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import {
  getOrCreateCompanyBillingProfile,
  listBillingProfileUpdateEvents,
} from "@/server/services/company-billing-profile.service";
import { BillingProfileForm } from "./billing-profile-form";

export default async function BillingProfilePage() {
  const context = await requireAuthenticatedWorkspace();

  const [profile, events] = await Promise.all([
    getOrCreateCompanyBillingProfile({
      companyId: context.membership.companyId,
    }),
    listBillingProfileUpdateEvents({
      companyId: context.membership.companyId,
    }),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Billing</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900 animate-fade-in">
          Billing Profile
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          These details are copied into future invoices and receipts.
        </p>
      </div>

      <div className="mt-6">
        <BillingProfileForm profile={profile} />
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Update History
          </h2>
        </div>

        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Reason</th>
                <th className="px-5 py-3">Created</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {events.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4 font-semibold text-gray-900">
                    {event.source}
                  </td>
                  <td className="px-5 py-4">
                    {event.actor?.email ?? "-"}
                  </td>
                  <td className="px-5 py-4">{event.reason ?? "-"}</td>
                  <td className="px-5 py-4">
                    {event.createdAt.toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    })}
                  </td>
                </tr>
              ))}

              {events.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-8 text-center text-sm text-gray-500"
                  >
                    No billing profile updates yet.
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
