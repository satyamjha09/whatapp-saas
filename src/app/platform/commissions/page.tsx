import {
  CommissionOperationsForm,
  CommissionRuleForm,
} from "@/app/platform/commissions/partner-commission-actions";
import { getPartnerCommissionDashboard } from "@/server/services/partner-commission.service";
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
  if (status === "AVAILABLE" || status === "PAID") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "PENDING_HOLD" || status === "INCLUDED_IN_PAYOUT") {
    return "bg-amber-50 text-amber-700";
  }

  if (status === "REVERSED" || status === "VOIDED") {
    return "bg-red-50 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

export default async function PlatformCommissionsPage() {
  const platform = await requirePlatformPermission("PLATFORM_COMMISSION_MANAGE");
  const canManage = roleHasPlatformPermission(
    platform.platformRole,
    "PLATFORM_COMMISSION_MANAGE",
  );
  const dashboard = await getPartnerCommissionDashboard();
  const reversibleAccruals = dashboard.accruals
    .filter(
      (accrual) =>
        accrual.type !== "REVERSAL" &&
        accrual.commissionAmountPaise > 0 &&
        !["INCLUDED_IN_PAYOUT", "PAID", "REVERSED"].includes(accrual.status),
    )
    .map((accrual) => ({
      id: accrual.id,
      label: `${accrual.partnerCompany.name} - ${moneyLabel(
        accrual.commissionAmountPaise,
        accrual.currency,
      )} - ${accrual.status}`,
    }));

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500">Platform Admin</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">
            Partner Commissions
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Manage referral commission rules, hold periods, immutable accruals,
            reversals, and the available balance that feeds partner payouts.
          </p>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pending hold</p>
          <p className="mt-2 text-2xl font-black text-amber-700">
            {moneyLabel(dashboard.totals.pendingHoldPaise)}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Available balance</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">
            {moneyLabel(dashboard.totals.availablePaise)}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Paid lifetime</p>
          <p className="mt-2 text-2xl font-black text-slate-950">
            {moneyLabel(dashboard.totals.paidPaise)}
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-2">
        <CommissionRuleForm
          canManage={canManage}
          partners={dashboard.partners.map((partner) => ({
            id: partner.id,
            name: partner.name,
          }))}
        />
        <CommissionOperationsForm
          canManage={canManage}
          reversibleAccruals={reversibleAccruals}
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
            Rules
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            Active and historical rulebook
          </h2>
          <div className="mt-4 space-y-3">
            {dashboard.rules.map((rule) => (
              <div key={rule.id} className="rounded-xl border bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-black text-slate-950">
                      {rule.partnerCompany.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {rule.planCode ?? "All plans"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      rule.active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {rule.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {rule.percentageBps ?? 0} bps +{" "}
                  {moneyLabel(rule.fixedAmountPaise ?? 0)} fixed · hold{" "}
                  {rule.holdDays} days
                </p>
              </div>
            ))}

            {dashboard.rules.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-sm text-slate-500">
                No commission rules created yet.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">
            Accrual ledger
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            Immutable commission records
          </h2>
          <div className="mt-4 overflow-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Partner</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Available</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {dashboard.accruals.map((accrual) => (
                  <tr key={accrual.id}>
                    <td className="px-4 py-4 font-bold text-slate-950">
                      {accrual.partnerCompany.name}
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {accrual.clientCompany?.name ?? "-"}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600">
                      {accrual.partnerBillingInvoice?.billingInvoice
                        .invoiceNumber ?? "-"}
                    </td>
                    <td className="px-4 py-4">{accrual.type}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                          accrual.status,
                        )}`}
                      >
                        {accrual.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-black text-slate-950">
                      {moneyLabel(accrual.commissionAmountPaise, accrual.currency)}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600">
                      {dateLabel(accrual.availableAt)}
                    </td>
                  </tr>
                ))}

                {dashboard.accruals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                      No commission accruals yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
