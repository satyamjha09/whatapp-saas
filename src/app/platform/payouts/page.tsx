import {
  PayoutApprovalForm,
  RequestPayoutForm,
} from "@/app/platform/payouts/partner-payout-actions";
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
  if (status === "PAID") return "bg-emerald-50 text-emerald-700";
  if (status === "APPROVED" || status === "PROCESSING") {
    return "bg-blue-50 text-blue-700";
  }
  if (status === "REQUESTED") return "bg-amber-50 text-amber-700";
  if (status === "FAILED" || status === "CANCELED") {
    return "bg-red-50 text-red-700";
  }
  return "bg-slate-100 text-slate-700";
}

export default async function PlatformPayoutsPage() {
  const platform = await requirePlatformPermission("PLATFORM_PAYOUT_APPROVE");
  const canApprove = roleHasPlatformPermission(
    platform.platformRole,
    "PLATFORM_PAYOUT_APPROVE",
  );
  const dashboard = await getPartnerCommissionDashboard();
  const availableByPartner = new Map<string, number>();

  for (const accrual of dashboard.accruals) {
    if (accrual.status !== "AVAILABLE") continue;
    availableByPartner.set(
      accrual.partnerCompanyId,
      (availableByPartner.get(accrual.partnerCompanyId) ?? 0) +
        accrual.commissionAmountPaise,
    );
  }

  const partnerBalances = dashboard.partners.map((partner) => ({
    id: partner.id,
    name: partner.name,
    availablePaise: availableByPartner.get(partner.id) ?? 0,
  }));
  const actionablePayouts = dashboard.payouts
    .filter((payout) => payout.status !== "PAID")
    .map((payout) => ({
      id: payout.id,
      status: payout.status,
      label: `${payout.partnerCompany.name} - ${moneyLabel(
        payout.amountPaise,
        payout.currency,
      )} - ${payout.status}`,
    }));

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500">Platform Admin</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">
            Partner Payouts
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Request, approve, pay, fail, and reconcile partner payouts from the
            available commission balance.
          </p>
        </div>
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Available to request</p>
          <p className="mt-2 text-2xl font-black text-emerald-700">
            {moneyLabel(dashboard.totals.availablePaise)}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Pending payout count</p>
          <p className="mt-2 text-2xl font-black text-amber-700">
            {
              dashboard.payouts.filter((payout) =>
                ["REQUESTED", "APPROVED", "PROCESSING"].includes(payout.status),
              ).length
            }
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
        <RequestPayoutForm canApprove={canApprove} partners={partnerBalances} />
        <PayoutApprovalForm
          canApprove={canApprove}
          payouts={actionablePayouts}
        />
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">
              Payout register
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              Approval and reconciliation history
            </h2>
          </div>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">
            {dashboard.payouts.length} payouts
          </div>
        </div>

        <div className="mt-5 overflow-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Partner</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Approved</th>
                <th className="px-4 py-3">Paid/failed</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Events</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dashboard.payouts.map((payout) => (
                <tr key={payout.id} className="align-top">
                  <td className="px-4 py-4">
                    <p className="font-black text-slate-950">
                      {payout.partnerCompany.name}
                    </p>
                    <p className="font-mono text-xs text-slate-500">
                      {payout.id}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(
                        payout.status,
                      )}`}
                    >
                      {payout.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-black text-slate-950">
                    {moneyLabel(payout.amountPaise, payout.currency)}
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-600">
                    {dateLabel(payout.requestedAt)}
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-600">
                    {dateLabel(payout.approvedAt)}
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-600">
                    {dateLabel(payout.paidAt ?? payout.failedAt)}
                  </td>
                  <td className="px-4 py-4 text-xs text-slate-600">
                    {payout.bankReference ?? payout.failureReason ?? "-"}
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      {payout.events.map((event) => (
                        <p key={event.id} className="text-xs text-slate-600">
                          {event.type} · {dateLabel(event.createdAt)}
                        </p>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}

              {dashboard.payouts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    No payout requests yet.
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
