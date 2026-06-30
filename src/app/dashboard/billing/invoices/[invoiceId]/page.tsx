import { notFound } from "next/navigation";
import { requireAuthenticatedWorkspace } from "@/server/auth/authorization";
import { getCompanyBillingInvoice } from "@/server/services/billing-invoice.service";

function money(paise: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
  }).format(paise / 100);
}

type PageProps = {
  params: Promise<{
    invoiceId: string;
  }>;
};

export default async function BillingInvoicePage({ params }: PageProps) {
  const context = await requireAuthenticatedWorkspace();
  const { invoiceId } = await params;

  const invoice = await getCompanyBillingInvoice({
    companyId: context.membership.companyId,
    invoiceId,
  });

  if (!invoice) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-8 print:px-0 print:py-0">
      <section className="rounded-2xl border bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="flex flex-wrap justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Invoice</h1>
            <p className="mt-2 text-sm text-gray-500">
              {invoice.invoiceNumber}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Status: {invoice.status}
            </p>
          </div>

          <p className="text-sm text-gray-500 print:hidden">
            Use browser print
          </p>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">From</p>
            <p className="mt-2 text-sm text-gray-700">{invoice.sellerName}</p>
            {invoice.sellerEmail && (
              <p className="text-sm text-gray-700">{invoice.sellerEmail}</p>
            )}
            {invoice.sellerAddress && (
              <p className="text-sm text-gray-700">{invoice.sellerAddress}</p>
            )}
            {invoice.sellerTaxId && (
              <p className="text-sm text-gray-700">
                Tax ID: {invoice.sellerTaxId}
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900">Bill To</p>
            <p className="mt-2 text-sm text-gray-700">
              {invoice.billingName ?? invoice.company.name}
            </p>
            {invoice.billingEmail && (
              <p className="text-sm text-gray-700">{invoice.billingEmail}</p>
            )}
            {invoice.billingAddress && (
              <p className="text-sm text-gray-700">{invoice.billingAddress}</p>
            )}
            {invoice.billingTaxId && (
              <p className="text-sm text-gray-700">
                Tax ID: {invoice.billingTaxId}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 grid gap-2 text-sm text-gray-700">
          <p>Issued: {invoice.issuedAt?.toLocaleString() ?? "-"}</p>
          <p>Paid: {invoice.paidAt?.toLocaleString() ?? "-"}</p>
          {invoice.cashfreePaymentId && (
            <p>Payment ID: {invoice.cashfreePaymentId}</p>
          )}
        </div>

        <section className="mt-8 overflow-hidden rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Qty</th>
                <th className="px-5 py-3">Unit</th>
                <th className="px-5 py-3 text-right">Total</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {invoice.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-5 py-4">{line.description}</td>
                  <td className="px-5 py-4">{line.quantity}</td>
                  <td className="px-5 py-4">
                    {money(line.unitAmountPaise, invoice.currency)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {money(line.totalPaise, invoice.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-8 ml-auto max-w-sm space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium">
              {money(invoice.subtotalPaise, invoice.currency)}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-500">
              Tax ({invoice.taxBasisPoints / 100}%)
            </span>
            <span className="font-medium">
              {money(invoice.taxPaise, invoice.currency)}
            </span>
          </div>

          <div className="flex justify-between border-t pt-3 text-lg font-bold">
            <span>Total</span>
            <span>{money(invoice.totalPaise, invoice.currency)}</span>
          </div>
        </section>

        <p className="mt-10 text-xs text-gray-500">
          This is a system-generated invoice/receipt. Please consult your
          accountant before using this as a statutory tax invoice.
        </p>
      </section>
    </main>
  );
}
