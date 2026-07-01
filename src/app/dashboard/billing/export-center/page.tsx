import {
  BarChart3,
  CalendarDays,
  Download,
  FileSpreadsheet,
  MessageCircle,
  ReceiptText,
  RotateCcw,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionButtonClass,
  fieldClass,
  labelClass,
  PageHeader,
  Panel,
  PanelTitle,
} from "@/app/dashboard/dashboard-ui";
import {
  BILLING_EXPORT_REPORTS,
  type BillingExportReportType,
} from "@/server/services/billing-export.service";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getUserPermissions } from "@/server/services/rbac-v2.service";

const reportIcons: Record<BillingExportReportType, LucideIcon> = {
  wallet_ledger: Wallet,
  message_usage: MessageCircle,
  failed_refunds: RotateCcw,
  billing_summary: BarChart3,
  invoices_gst: ReceiptText,
  customer_usage: Users,
  date_wise_billing: CalendarDays,
};

function dateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function currentMonthRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  return {
    from: dateInputValue(from),
    to: dateInputValue(to),
  };
}

function downloadHref({
  from,
  reportType,
  to,
}: {
  from: string;
  reportType: BillingExportReportType;
  to: string;
}) {
  const params = new URLSearchParams({
    from,
    reportType,
    to,
  });

  return `/api/billing/exports/download?${params.toString()}`;
}

export default async function BillingExportCenterPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const permissions = await getUserPermissions({
    companyId: context.membership.companyId,
    userId: context.user.id,
  });
  const hasBillingAccess = permissions.has("BILLING_VIEW");
  const range = currentMonthRange();

  if (!hasBillingAccess) {
    return (
      <div>
        <PageHeader
          eyebrow="Billing"
          title="Export Center"
          description="Download accounting-ready billing reports for this workspace."
        />

        <Panel>
          <PanelTitle
            title="Billing access required"
            description="Ask an owner or admin to grant Billing View permission before downloading accounting exports."
          />
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Export Center"
        description="Download wallet, usage, invoice, refund, and billing CSV reports for accounting and reconciliation."
        actions={
          <Link href="/dashboard/billing" className={actionButtonClass("secondary")}>
            <Wallet className="mr-2 h-4 w-4" />
            Credit Center
          </Link>
        }
      />

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PanelTitle
            title="Create CSV export"
            description="Choose a report and date range. Small and medium reports download immediately."
          />
          <div className="inline-flex items-center gap-2 rounded-full bg-[#E7F8EF] px-3 py-1 text-xs font-semibold text-[#128C7E]">
            <FileSpreadsheet className="h-4 w-4" />
            CSV
          </div>
        </div>

        <form
          action="/api/billing/exports/download"
          className="mt-5 grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_minmax(150px,0.7fr)_minmax(150px,0.7fr)_auto]"
          method="get"
        >
          <label>
            <span className={labelClass}>Report</span>
            <select className={fieldClass} name="reportType" defaultValue="wallet_ledger">
              {BILLING_EXPORT_REPORTS.map((report) => (
                <option key={report.type} value={report.type}>
                  {report.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className={labelClass}>From</span>
            <input
              className={fieldClass}
              defaultValue={range.from}
              name="from"
              type="date"
            />
          </label>

          <label>
            <span className={labelClass}>To</span>
            <input
              className={fieldClass}
              defaultValue={range.to}
              name="to"
              type="date"
            />
          </label>

          <div className="flex items-end">
            <button className={actionButtonClass()} type="submit">
              <Download className="mr-2 h-4 w-4" />
              Download
            </button>
          </div>
        </form>
      </Panel>

      <section className="mt-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#081B3A]">Monthly quick exports</h2>
            <p className="mt-1 text-sm text-[#526173]">
              Current month: {range.from} to {range.to}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {BILLING_EXPORT_REPORTS.map((report) => {
            const Icon = reportIcons[report.type];

            return (
              <article
                className="rounded-2xl border border-[#BFE9D0] bg-white p-4 shadow-[0_14px_34px_rgba(8,27,58,0.07)]"
                key={report.type}
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-[#081B3A]">
                      {report.label}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#526173]">
                      {report.description}
                    </p>
                  </div>
                </div>

                <Link
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-sm font-semibold text-[#128C7E] transition hover:border-[#128C7E]/30 hover:bg-[#E7F8EF]"
                  href={downloadHref({
                    from: range.from,
                    reportType: report.type,
                    to: range.to,
                  })}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Current month
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
