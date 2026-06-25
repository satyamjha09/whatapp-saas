import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import { listBillingDocumentEmailDeliveries } from "@/server/services/billing-document-email.service";

export default async function BillingEmailDeliveriesPage() {
  const context = await requireAuthenticatedWorkspace();

  const deliveries = await listBillingDocumentEmailDeliveries({
    companyId: context.membership.companyId,
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Billing</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          Billing Email Deliveries
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Invoice, credit note, and refund email delivery history.
        </p>
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm animate-fade-in">
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Recipient</th>
                <th className="px-5 py-3">Subject</th>
                <th className="px-5 py-3">Attempts</th>
                <th className="px-5 py-3">Sent</th>
                <th className="px-5 py-3">Error</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {deliveries.map((delivery) => (
                <tr key={delivery.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4 font-semibold text-gray-900">
                    {delivery.type}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${
                        delivery.status === "SENT"
                          ? "bg-green-50 text-green-700"
                          : delivery.status === "FAILED"
                          ? "bg-red-50 text-red-700"
                          : "bg-gray-50 text-gray-600"
                      }`}
                    >
                      {delivery.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">{delivery.recipientEmail}</td>
                  <td className="px-5 py-4">{delivery.subject}</td>
                  <td className="px-5 py-4">{delivery.attempts}</td>
                  <td className="px-5 py-4">
                    {delivery.sentAt?.toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                    }) ?? "-"}
                  </td>
                  <td className="px-5 py-4 text-red-600 max-w-xs truncate" title={delivery.failureReason ?? undefined}>
                    {delivery.failureReason ?? "-"}
                  </td>
                </tr>
              ))}

              {deliveries.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-8 text-center text-sm text-gray-500"
                  >
                    No billing emails sent yet.
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
