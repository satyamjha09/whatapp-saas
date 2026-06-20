import {
  Braces,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  MessageCircle,
  ReceiptText,
  Users,
  Wallet,
  Webhook,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  actionButtonClass,
  EmptyState,
  PageHeader,
  Panel,
  PanelTitle,
  StatusPill,
  statusTone,
} from "@/app/dashboard/dashboard-ui";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getBillingOverviewByCompany } from "@/server/services/billing-plan.service";
import { getBillingSummary } from "@/server/services/wallet.service";

function formatMoney(amountPaise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amountPaise / 100);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default async function BillingPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) redirect("/sign-in");
  if (!context.membership) redirect("/onboarding");

  const companyId = context.membership.companyId;
  const [billing, walletSummary] = await Promise.all([
    getBillingOverviewByCompany(companyId),
    getBillingSummary(companyId),
  ]);
  const usagePercent = billing.monthlyMessageLimit
    ? Math.min(
        Math.round(
          (billing.messagesUsedThisPeriod / billing.monthlyMessageLimit) * 100,
        ),
        100,
      )
    : 0;
  const planLimits = [
    {
      label: "Team members",
      value: billing.limits.teamMemberLimit.toLocaleString("en-IN"),
      icon: Users,
    },
    {
      label: "Templates",
      value: billing.limits.templateLimit.toLocaleString("en-IN"),
      icon: ReceiptText,
    },
    {
      label: "Campaigns",
      value: billing.limits.campaignLimit.toLocaleString("en-IN"),
      icon: MessageCircle,
    },
    {
      label: "Developer API",
      value: billing.limits.developerApiAccess ? "Enabled" : "Not included",
      icon: Braces,
    },
    {
      label: "Developer webhooks",
      value: billing.limits.developerWebhookAccess
        ? "Enabled"
        : "Not included",
      icon: Webhook,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={context.membership.company.name}
        title="Billing"
        description="Monitor your subscription, monthly usage, plan limits, and wallet ledger."
        actions={
          <Link href="/dashboard/wallet" className={actionButtonClass()}>
            <Wallet className="mr-2 h-4 w-4" />
            Open Wallet
          </Link>
        }
      />

      <section className="mb-5 grid gap-3 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-[#D8E6F3] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)] sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-[#2070B0]">
                Current plan
              </p>
              <h2 className="mt-2 text-3xl font-bold text-[#081B3A]">
                {billing.planName}
              </h2>
              <div className="mt-3">
                <StatusPill tone={statusTone(billing.subscriptionStatus)}>
                  {billing.subscriptionStatus.replaceAll("_", " ")}
                </StatusPill>
              </div>
            </div>
            <div className="rounded-xl border border-[#D8E6F3] bg-[#F0F8FF] p-4 text-right">
              <CreditCard className="ml-auto h-5 w-5 text-[#0052CC]" />
              <p className="mt-2 text-xs text-[#526173]">Wallet balance</p>
              <p className="mt-1 text-xl font-bold text-[#081B3A]">
                {formatMoney(walletSummary.wallet.balancePaise)}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-[#D8E6F3] pt-4 text-xs text-[#526173]">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#2070B0]" />
              {formatDate(billing.currentPeriodStart)} -{" "}
              {formatDate(billing.currentPeriodEnd)}
            </span>
            {billing.trialEndsAt ? (
              <span>Trial ends {formatDate(billing.trialEndsAt)}</span>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-[#D8E6F3] bg-white p-5 shadow-[0_16px_40px_rgba(8,27,58,0.08)] sm:p-6">
          <p className="text-sm font-bold text-[#081B3A]">
            Monthly message usage
          </p>
          <p className="mt-2 text-3xl font-bold text-[#081B3A]">
            {billing.messagesUsedThisPeriod.toLocaleString("en-IN")}
            <span className="text-base font-medium text-[#526173]">
              {" "}/ {billing.monthlyMessageLimit.toLocaleString("en-IN")}
            </span>
          </p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#D8E6F3]/70">
            <div
              className="h-full rounded-full bg-[#0052CC] transition-[width]"
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-[#526173]">
            <span>{usagePercent}% used</span>
            <span>
              {billing.messagesRemainingThisPeriod.toLocaleString("en-IN")}{" "}
              remaining
            </span>
          </div>
        </div>
      </section>

      <Panel className="mb-5">
        <PanelTitle
          title="Plan limits"
          description="Current workspace capacity and feature availability."
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {planLimits.map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-[#D8E6F3] bg-[#F0F8FF] p-4"
            >
              <Icon className="h-4 w-4 text-[#0052CC]" />
              <p className="mt-3 text-xs text-[#526173]">{label}</p>
              <p className="mt-1 text-sm font-bold text-[#081B3A]">{value}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PanelTitle
            title="Billing transactions"
            description={`${walletSummary.summary.successfulTransactionCount} successful transactions`}
          />
          <Link
            href="/dashboard/wallet"
            className={actionButtonClass("secondary")}
          >
            Top Up Wallet
          </Link>
        </div>

        {walletSummary.transactions.length === 0 ? (
          <div className="mt-5">
            <EmptyState>No billing transactions yet.</EmptyState>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#D8E6F3] text-[#526173]">
                  <th className="py-3 pr-4 font-medium">Type</th>
                  <th className="py-3 pr-4 font-medium">Amount</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Reference</th>
                  <th className="py-3 pr-4 font-medium">Description</th>
                  <th className="py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {walletSummary.transactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="border-b border-[#D8E6F3]/70 last:border-0"
                  >
                    <td className="py-3 pr-4 font-medium text-[#102040]">
                      {transaction.type}
                    </td>
                    <td className="py-3 pr-4 font-semibold text-[#081B3A]">
                      {formatMoney(transaction.amountPaise)}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#15803d]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {transaction.status}
                      </span>
                    </td>
                    <td className="max-w-44 truncate py-3 pr-4 text-[#526173]">
                      {transaction.referenceId ?? "-"}
                    </td>
                    <td className="max-w-64 truncate py-3 pr-4 text-[#526173]">
                      {transaction.description ?? "-"}
                    </td>
                    <td className="whitespace-nowrap py-3 text-[#526173]">
                      {transaction.createdAt.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
