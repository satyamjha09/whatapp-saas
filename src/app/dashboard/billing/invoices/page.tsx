import Link from "next/link";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import { listCompanyBillingInvoices } from "@/server/services/billing-invoice.service";
import { SendInvoiceEmailButton } from "@/app/dashboard/billing/document-email-actions";

function money(paise: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(paise / 100);
}

export default async function BillingInvoicesPage() {
  const context = await requireAuthenticatedWorkspace();

  const invoices = await listCompanyBillingInvoices({
    companyId: context.membership.companyId,
  });

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Billing</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          Invoices & Receipts
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Payment invoices, receipts, taxes, and plan upgrade history.
        </p>
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b bg-gray-50 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Invoices</h2>
        </div>

        <div className="overflow-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Invoice</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Subtotal</th>
                <th className="px-5 py-3">Tax</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Paid</th>
                <th className="px-5 py-3">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-5 py-4 font-semibold text-gray-900">
                    {invoice.invoiceNumber}
                  </td>
                  <td className="px-5 py-4">{invoice.status}</td>
                  <td className="px-5 py-4">
                    {money(invoice.subtotalPaise, invoice.currency)}
                  </td>
                  <td className="px-5 py-4">
                    {money(invoice.taxPaise, invoice.currency)}
                  </td>
                  <td className="px-5 py-4 font-semibold">
                    {money(invoice.totalPaise, invoice.currency)}
                  </td>
                  <td className="px-5 py-4">
                    {invoice.paidAt?.toLocaleString() ?? "-"}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/billing/invoices/${invoice.id}`}
                        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 transition"
                      >
                        View / Print
                      </Link>
                      <SendInvoiceEmailButton invoiceId={invoice.id} />
                    </div>
                  </td>
                </tr>
              ))}

              {invoices.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-8 text-center text-sm text-gray-500"
                  >
                    No invoices yet.
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
