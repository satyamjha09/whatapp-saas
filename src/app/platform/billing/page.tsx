import {
  GeneratePartnerInvoiceForm,
  PartnerBillingOwnerForm,
  PartnerBillingPaymentForm,
} from "@/app/platform/billing/partner-billing-actions";
import { getPartnerBillingDashboard } from "@/server/services/partner-billing.service";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";
import { roleHasPlatformPermission } from "@/server/tenant/platform-permissions";

function moneyLabel(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function dateLabel(value: Date | string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === "PAID") return "bg-emerald-50 text-emerald-700";
  if (status === "OVERDUE" || status === "FAILED") {
    return "bg-red-50 text-red-700";
  }
  if (status === "ISSUED" || status === "AWAITING_PAYMENT") {
    return "bg-amber-50 text-amber-700";
  }
  return "bg-slate-100 text-slate-700";
}

export default async function PlatformBillingPage() {
  const platform = await requirePlatformPermission("PLATFORM_BILLING_VIEW");
  const canManage = roleHasPlatformPermission(
    platform.platformRole,
    "PLATFORM_BILLING_MANAGE",
  );
  const dashboard = await getPartnerBillingDashboard();
  const subscriptionOptions = dashboard.activeSubscriptions.map((subscription) => ({
    id: subscription.id,
    label: `${subscription.clientCompany.name} - ${subscription.platformPlanCode} (${moneyLabel(
      subscription.retailAmountPaise,
      subscription.currency,
    )})`,
    partnerName: subscription.partnerCompany.name,
    clientName: subscription.clientCompany.name,
    billingOwnerType: subscription.billingOwnerType,
  }));
  const payableInvoices = dashboard.invoices
    .filter((invoice) => invoice.paymentStatus !== "PAID")
    .map((invoice) => ({
      id: invoice.id,
      paymentStatus: invoice.paymentStatus,
      label: `${invoice.billingInvoice.invoiceNumber} - ${invoice.direction} - ${moneyLabel(
        invoice.totalPaise,
        invoice.currency,
      )}`,
    }));

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500">Platform Admin</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">
            Partner Billing
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Manage MetaWhat-to-partner wholesale billing, partner-to-client retail
            invoicing, taxes, payment collection, and overdue handling.
          </p>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Total billed</p>
          <p className="mt-2 text-2xl font-black text-slate-950">
            {moneyLabel(dashboard.totals.totalPaise)}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Paid</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">
            {moneyLabel(dashboard.totals.paidPaise)}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Awaiting payment</p>
          <p className="mt-2 text-2xl font-black text-amber-700">
            {moneyLabel(dashboard.totals.pendingPaise)}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Overdue</p>
          <p className="mt-2 text-2xl font-black text-red-700">
            {moneyLabel(dashboard.totals.overduePaise)}
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        <GeneratePartnerInvoiceForm
          canManage={canManage}
          subscriptions={subscriptionOptions}
        />
        <PartnerBillingOwnerForm
          canManage={canManage}
          subscriptions={subscriptionOptions}
        />
        <PartnerBillingPaymentForm
          canManage={canManage}
          invoices={payableInvoices}
        />
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
              Invoice register
            </p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">
              Partner billing documents
            </h2>
          </div>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
            {dashboard.invoices.length} documents
          </div>
        </div>

        <div className="mt-5 overflow-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Partner</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dashboard.invoices.map((invoice) => (
                <tr key={invoice.id} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-black text-slate-950">
                      {invoice.billingInvoice.invoiceNumber}
                    </p>
                    <p className="text-xs text-slate-500">{invoice.status}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                      {invoice.direction.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-medium text-slate-800">
                    {invoice.partnerCompany.name}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {invoice.clientCompany?.name ?? "-"}
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-600">
                    {dateLabel(invoice.periodStart)}
                    <br />
                    {dateLabel(invoice.periodEnd)}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {dateLabel(invoice.dueAt)}
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-black text-slate-950">
                      {moneyLabel(invoice.totalPaise, invoice.currency)}
                    </p>
                    <p className="text-xs text-slate-500">
                      Tax {moneyLabel(invoice.taxPaise, invoice.currency)}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                        invoice.paymentStatus,
                      )}`}
                    >
                      {invoice.paymentStatus.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-600">
                    {invoice.billingInvoice.pdfRenders[0]?.status ?? "Not rendered"}
                  </td>
                </tr>
              ))}
              {dashboard.invoices.length === 0 ? (
                <tr>
                  <td className="px-4 py-12 text-center text-slate-500" colSpan={9}>
                    No partner billing invoices generated yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 text-sm text-emerald-900">
        Existing invoice PDF and email endpoints continue to work through the
        linked billing invoice ID. Payment gateway collection can now attach to
        the partner billing payment fields without changing subscription pricing.
      </section>
    </main>
  );
}
