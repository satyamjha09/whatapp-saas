import { PartnerUsageActions } from "@/app/platform/usage/partner-usage-actions";
import { getPartnerUsageDashboard } from "@/server/services/partner-usage.service";
import { requirePlatformPermission } from "@/server/tenant/tenant-context";

function moneyLabel(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function dateLabel(value: Date | string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function percentLabel(bps: number) {
  return `${(bps / 100).toFixed(1)}%`;
}

function metricCard(label: string, value: string, helper: string) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-xs font-semibold text-slate-500">{helper}</p>
    </div>
  );
}

export default async function PlatformUsagePage({
  searchParams,
}: {
  searchParams?: Promise<{ from?: string; to?: string; partnerCompanyId?: string }>;
}) {
  await requirePlatformPermission("PLATFORM_USAGE_VIEW");
  const params = (await searchParams) ?? {};
  const dashboard = await getPartnerUsageDashboard(params);
  const exportParams = new URLSearchParams();
  if (params.from) exportParams.set("from", params.from);
  if (params.to) exportParams.set("to", params.to);
  if (params.partnerCompanyId) {
    exportParams.set("partnerCompanyId", params.partnerCompanyId);
  }
  exportParams.set("format", "csv");

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-medium text-slate-500">Platform Admin</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">
            Partner Usage Reports
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Daily client usage, partner margin, limit alerts, and CSV exports for
            white-label and reseller operations.
          </p>
        </div>
        <PartnerUsageActions
          exportHref={`/api/platform/partner-usage?${exportParams.toString()}`}
        />
      </div>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCard(
          "Outbound messages",
          dashboard.totals.outboundMessages.toLocaleString("en-IN"),
          `${dashboard.totals.campaignMessages.toLocaleString("en-IN")} campaign messages`,
        )}
        {metricCard(
          "Active clients",
          dashboard.totals.clientCount.toLocaleString("en-IN"),
          `${dashboard.partnerSummary.length.toLocaleString("en-IN")} partners reporting`,
        )}
        {metricCard(
          "Gross margin",
          moneyLabel(dashboard.totals.grossMarginPaise),
          `${percentLabel(dashboard.totals.marginBasisPoints)} blended margin`,
        )}
        {metricCard(
          "Open limit alerts",
          dashboard.alerts.length.toLocaleString("en-IN"),
          `${dashboard.totals.limitAlertCount.toLocaleString("en-IN")} daily row alerts`,
        )}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-700">
            Margin dashboard
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            Partner rollup
          </h2>
          <div className="mt-4 space-y-3">
            {dashboard.partnerSummary.map((partner) => (
              <div key={partner.partnerCompanyId} className="rounded-xl border bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{partner.partnerName}</p>
                    <p className="text-xs font-semibold text-slate-500">
                      {partner.clientCount} clients · {partner.outboundMessages} outbound
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                    {percentLabel(partner.marginBasisPoints)} margin
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-600">
                  <span>Retail {moneyLabel(partner.retailChargePaise)}</span>
                  <span>Cost {moneyLabel(partner.platformCostPaise)}</span>
                  <span>Margin {moneyLabel(partner.grossMarginPaise)}</span>
                </div>
              </div>
            ))}
            {dashboard.partnerSummary.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-sm text-slate-500">
                No usage rows yet. Run daily aggregation after partner client activity.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-700">
            Limit alerts
          </p>
          <h2 className="mt-1 text-xl font-black text-slate-950">
            Clients needing attention
          </h2>
          <div className="mt-4 space-y-3">
            {dashboard.alerts.map((alert) => (
              <div key={alert.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">
                      {alert.clientCompany.name}
                    </p>
                    <p className="text-xs font-semibold text-slate-600">
                      Partner: {alert.partnerCompany.name}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-amber-700">
                    {alert.status}
                  </span>
                </div>
                <p className="mt-3 text-sm text-amber-800">
                  {alert.message ?? `${alert.metric}: ${alert.currentValue}/${alert.threshold}`}
                </p>
              </div>
            ))}
            {dashboard.alerts.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-sm text-slate-500">
                No open usage limit alerts.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-700">
              Client usage dashboard
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-950">
              Daily usage ledger
            </h2>
          </div>
          <p className="text-sm font-semibold text-slate-500">
            {dateLabel(dashboard.range.from)} - {dateLabel(dashboard.range.to)}
          </p>
        </div>
        <div className="mt-4 overflow-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Partner</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Outbound</th>
                <th className="px-4 py-3">Inbound</th>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Contacts</th>
                <th className="px-4 py-3">Retail</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Margin</th>
                <th className="px-4 py-3">Alerts</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {dashboard.rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-4 text-slate-600">{dateLabel(row.date)}</td>
                  <td className="px-4 py-4 font-bold text-slate-950">
                    {row.partnerCompany.name}
                  </td>
                  <td className="px-4 py-4 text-slate-700">{row.clientCompany.name}</td>
                  <td className="px-4 py-4">{row.outboundMessages}</td>
                  <td className="px-4 py-4">{row.inboundMessages}</td>
                  <td className="px-4 py-4">{row.campaignMessages}</td>
                  <td className="px-4 py-4">{row.activeContacts}</td>
                  <td className="px-4 py-4">{moneyLabel(row.retailChargePaise, row.currency)}</td>
                  <td className="px-4 py-4">{moneyLabel(row.platformCostPaise, row.currency)}</td>
                  <td className="px-4 py-4 font-black text-emerald-700">
                    {moneyLabel(row.grossMarginPaise, row.currency)}
                  </td>
                  <td className="px-4 py-4">{row.limitAlertCount}</td>
                </tr>
              ))}
              {dashboard.rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center text-slate-500">
                    No usage rows found for this date range.
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
