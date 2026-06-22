import {
  AlertTriangle,
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
import { getCreditCenterOverview } from "@/server/services/credit-center.service";
import { getSubscriptionOverview } from "@/server/services/subscription.service";
import { getTeamMemberPlanUsage } from "@/server/services/plan-limit.service";
import { getCompanyFeatureAccess } from "@/server/services/feature-gate.service";
import { getDeveloperApiUsage } from "@/server/services/developer-api-usage.service";
import SubscriptionPlanCard from "./subscription-plan-card";
import CheckSubscriptionExpiryButton from "./check-subscription-expiry-button";
import SubscriptionCancelResumeButton from "./subscription-cancel-resume-button";

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
  const [billing, overview, subscription, teamUsage, featureAccess] = await Promise.all([
    getBillingOverviewByCompany(companyId),
    getCreditCenterOverview(companyId),
    getSubscriptionOverview(companyId),
    getTeamMemberPlanUsage(companyId),
    getCompanyFeatureAccess(companyId),
  ]);
  const canManage = ["OWNER", "ADMIN"].includes(context.membership.role);
  const subscriptionMaintenanceRuns = [
    ...overview.recentSubscriptionExpiryRuns,
    ...overview.recentSubscriptionCancellationRuns,
  ].sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime());
  const developerUsage = featureAccess.enabledFeatures.includes("DEVELOPER_API")
    ? await getDeveloperApiUsage(companyId)
    : null;
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
      label: "Team seats",
      value: `${teamUsage.usedSeats.toLocaleString("en-IN")} / ${teamUsage.maxTeamMembers.toLocaleString("en-IN")}`,
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
          <>
            {canManage ? <CheckSubscriptionExpiryButton /> : null}
            <Link href="/dashboard/wallet" className={actionButtonClass()}>
              <Wallet className="mr-2 h-4 w-4" />
              Open Wallet
            </Link>
          </>
        }
      />

      {subscription.company.subscriptionStatus === "PAST_DUE" ? (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" />
          <div>
            <h2 className="text-sm font-bold text-rose-900">Subscription past due</h2>
            <p className="mt-1 text-sm text-rose-700">
              Your paid period has expired. Use Renew plan on your current plan below to continue sending messages.
            </p>
          </div>
        </div>
      ) : null}

      {subscription.renewal.isExpiringSoon ? (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#F8C830]/45 bg-[#F8C830]/10 p-4">
          <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-[#7A5A00]" />
          <div>
            <h2 className="text-sm font-bold text-[#081B3A]">Subscription expiring soon</h2>
            <p className="mt-1 text-sm text-[#526173]">
              Your current plan expires in {subscription.renewal.daysUntilExpiry} day(s). Renew early without losing paid days.
            </p>
          </div>
        </div>
      ) : null}

      {subscription.company.cancelAtPeriodEnd &&
      subscription.company.currentPeriodEnd ? (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#F8C830]/45 bg-[#F8C830]/10 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#7A5A00]" />
          <div>
            <h2 className="text-sm font-bold text-[#081B3A]">Cancellation scheduled</h2>
            <p className="mt-1 text-sm text-[#526173]">
              Your paid plan remains active until {formatDate(subscription.company.currentPeriodEnd)}, then this workspace moves to Free.
            </p>
          </div>
        </div>
      ) : null}

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
                {formatMoney(overview.wallet.balancePaise)}
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
          title="Feature access"
          description="Product areas enabled by the current workspace plan."
        />
        {featureAccess.enabledFeatures.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {featureAccess.enabledFeatures.map((feature) => (
              <span key={feature} className="rounded-full bg-[#22C55E]/10 px-3 py-1.5 text-xs font-semibold text-[#15803d]">
                {feature.replaceAll("_", " ")}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            Paid features are unavailable until this subscription is renewed.
          </p>
        )}
        {developerUsage ? (
          <div className="mt-4 rounded-xl border border-[#D8E6F3] bg-[#F0F8FF] p-3">
            <p className="text-xs text-[#526173]">Developer API today</p>
            <p className="mt-1 text-xl font-bold text-[#081B3A]">
              {developerUsage.usedToday.toLocaleString("en-IN")} / {developerUsage.dailyLimit.toLocaleString("en-IN")}
            </p>
          </div>
        ) : null}
      </Panel>

      <section className="mb-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#081B3A]">Available plans</h2>
            <p className="mt-1 text-sm text-[#526173]">
              {subscription.currentPlan.name} / {subscription.company.subscriptionStatus}
              {subscription.company.currentPeriodEnd
                ? ` / expires ${formatDate(subscription.company.currentPeriodEnd)}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-start justify-end gap-2">
            <SubscriptionCancelResumeButton
              canManage={canManage}
              billingPlan={subscription.company.billingPlan}
              subscriptionStatus={subscription.company.subscriptionStatus}
              cancelAtPeriodEnd={subscription.company.cancelAtPeriodEnd}
            />
            <p className="rounded-lg border border-[#D8E6F3] bg-white px-3 py-2 text-xs text-[#526173]">
              {subscription.quota.usedMessages.toLocaleString("en-IN")} of {subscription.quota.monthlyMessageLimit.toLocaleString("en-IN")} messages used
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {subscription.plans.map((plan) => (
            <SubscriptionPlanCard
              key={plan.id}
              plan={plan}
              currentPlan={subscription.company.billingPlan}
              canManage={canManage}
              renewal={subscription.renewal}
            />
          ))}
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
            description={`${overview.summary.successfulTransactionCount} successful transactions`}
          />
          <Link
            href="/dashboard/wallet"
            className={actionButtonClass("secondary")}
          >
            Top Up Wallet
          </Link>
        </div>

        {overview.transactions.length === 0 ? (
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
                {overview.transactions.map((transaction) => (
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

      <Panel className="mt-5">
        <PanelTitle
          title="Subscription payments"
          description="Razorpay orders for workspace plan upgrades."
        />
        {overview.subscriptionPayments.length === 0 ? (
          <div className="mt-5"><EmptyState>No subscription payments yet.</EmptyState></div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead><tr className="border-b border-[#D8E6F3] text-[#526173]"><th className="py-3 pr-4 font-medium">Created</th><th className="py-3 pr-4 font-medium">Plan</th><th className="py-3 pr-4 font-medium">Amount</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 pr-4 font-medium">Order</th><th className="py-3 font-medium">Payment</th></tr></thead>
              <tbody>
                {overview.subscriptionPayments.map((payment) => (
                  <tr key={payment.id} className="border-b border-[#D8E6F3]/70 last:border-0">
                    <td className="whitespace-nowrap py-3 pr-4 text-[#526173]">{payment.createdAt.toLocaleString("en-IN")}</td>
                    <td className="py-3 pr-4 font-semibold text-[#102040]">{payment.plan}</td>
                    <td className="py-3 pr-4 font-semibold text-[#081B3A]">{formatMoney(payment.amountPaise)}</td>
                    <td className="py-3 pr-4"><StatusPill tone={payment.status === "PAID" ? "green" : payment.status === "FAILED" ? "red" : "amber"}>{payment.status}</StatusPill></td>
                    <td className="max-w-48 truncate py-3 pr-4 text-[#526173]">{payment.razorpayOrderId}</td>
                    <td className="max-w-48 truncate py-3 text-[#526173]">{payment.razorpayPaymentId ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="mt-5">
        <PanelTitle
          title="Subscription maintenance runs"
          description="Recent expiry and cancellation checks for this workspace."
        />
        {subscriptionMaintenanceRuns.length === 0 ? (
          <div className="mt-5"><EmptyState>No subscription maintenance runs yet.</EmptyState></div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead><tr className="border-b border-[#D8E6F3] text-[#526173]"><th className="py-3 pr-4 font-medium">Started</th><th className="py-3 pr-4 font-medium">Job</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 pr-4 font-medium">Checked</th><th className="py-3 pr-4 font-medium">Updated</th><th className="py-3 pr-4 font-medium">Completed</th><th className="py-3 font-medium">Error</th></tr></thead>
              <tbody>
                {subscriptionMaintenanceRuns.map((run) => (
                  <tr key={run.id} className="border-b border-[#D8E6F3]/70 last:border-0">
                    <td className="whitespace-nowrap py-3 pr-4 text-[#526173]">{run.startedAt.toLocaleString("en-IN")}</td>
                    <td className="py-3 pr-4 font-medium text-[#102040]">{run.jobName === "subscription-cancellation-check" ? "Cancellation" : "Expiry"}</td>
                    <td className="py-3 pr-4"><StatusPill tone={run.status === "COMPLETED" ? "green" : run.status === "FAILED" ? "red" : "blue"}>{run.status}</StatusPill></td>
                    <td className="py-3 pr-4 text-[#102040]">{run.checkedCount}</td>
                    <td className="py-3 pr-4 text-[#102040]">{run.recoveredCount}</td>
                    <td className="whitespace-nowrap py-3 pr-4 text-[#526173]">{run.completedAt?.toLocaleString("en-IN") ?? "-"}</td>
                    <td className="max-w-64 truncate py-3 text-[#526173]">{run.errorMessage ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="mt-5">
        <PanelTitle
          title="Credit purchases"
          description="Recent Razorpay checkout orders for this workspace."
        />
        {overview.creditPurchases.length === 0 ? (
          <div className="mt-5">
            <EmptyState>No Razorpay credit purchases yet.</EmptyState>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#D8E6F3] text-[#526173]">
                  <th className="py-3 pr-4 font-medium">Created</th>
                  <th className="py-3 pr-4 font-medium">Pack</th>
                  <th className="py-3 pr-4 font-medium">Credits</th>
                  <th className="py-3 pr-4 font-medium">Paid amount</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 font-medium">Order</th>
                </tr>
              </thead>
              <tbody>
                {overview.creditPurchases.map((purchase) => (
                  <tr
                    key={purchase.id}
                    className="border-b border-[#D8E6F3]/70 last:border-0"
                  >
                    <td className="whitespace-nowrap py-3 pr-4 text-[#526173]">
                      {purchase.createdAt.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 pr-4 font-medium text-[#102040]">
                      {purchase.packId}
                    </td>
                    <td className="py-3 pr-4 text-[#102040]">
                      {purchase.credits.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 pr-4 font-semibold text-[#081B3A]">
                      {formatMoney(purchase.amountPaise)}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill
                        tone={
                          purchase.status === "PAID"
                            ? "green"
                            : purchase.status === "FAILED"
                              ? "red"
                              : "amber"
                        }
                      >
                        {purchase.status}
                      </StatusPill>
                    </td>
                    <td className="max-w-52 truncate py-3 text-[#526173]">
                      {purchase.razorpayOrderId}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel className="mt-5">
        <PanelTitle
          title="Razorpay webhooks"
          description="Signed payment events attributed to this workspace."
        />
        {overview.razorpayWebhookEvents.length === 0 ? (
          <div className="mt-5">
            <EmptyState>No Razorpay webhook events yet.</EmptyState>
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#D8E6F3] text-[#526173]">
                  <th className="py-3 pr-4 font-medium">Received</th>
                  <th className="py-3 pr-4 font-medium">Event</th>
                  <th className="py-3 pr-4 font-medium">Status</th>
                  <th className="py-3 pr-4 font-medium">Processed</th>
                  <th className="py-3 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {overview.razorpayWebhookEvents.map((event) => (
                  <tr
                    key={event.id}
                    className="border-b border-[#D8E6F3]/70 last:border-0"
                  >
                    <td className="whitespace-nowrap py-3 pr-4 text-[#526173]">
                      {event.createdAt.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 pr-4 font-medium text-[#102040]">
                      {event.eventType}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill
                        tone={
                          event.status === "PROCESSED"
                            ? "green"
                            : event.status === "FAILED"
                              ? "red"
                              : event.status === "RECEIVED"
                                ? "blue"
                                : "zinc"
                        }
                      >
                        {event.status}
                      </StatusPill>
                    </td>
                    <td className="whitespace-nowrap py-3 pr-4 text-[#526173]">
                      {event.processedAt
                        ? event.processedAt.toLocaleString("en-IN")
                        : "-"}
                    </td>
                    <td className="max-w-72 truncate py-3 text-[#526173]">
                      {event.errorMessage ?? "-"}
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
