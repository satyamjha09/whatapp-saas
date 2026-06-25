import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getCompanyPlanAccessSummary } from "@/server/services/company-plan-assignment.service";

function formatDate(value: Date | null | undefined) {
  return value ? value.toLocaleDateString("en-IN") : "-";
}

function statusClass(status: string | undefined) {
  if (status === "TRIAL" || status === "ACTIVE") {
    return "bg-green-50 text-green-700";
  }

  if (status === "SUSPENDED") {
    return "bg-yellow-50 text-yellow-700";
  }

  return "bg-red-50 text-red-700";
}

export default async function AccountCurrentPlanPage() {
  const context = await getCurrentWorkspaceContext();

  if (!context) {
    redirect("/sign-in");
  }

  if (!context.membership) {
    redirect("/onboarding");
  }

  const summary = await getCompanyPlanAccessSummary(
    context.membership.companyId,
  );
  const plan = summary.currentPlan;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div>
        <p className="text-sm font-medium text-gray-500">Account</p>
        <h1 className="mt-1 text-3xl font-bold text-gray-900">
          Current Plan
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          View your workspace access status, trial dates, and assigned platform
          plan.
        </p>
      </div>

      <section className="mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">Assigned plan</p>
            <h2 className="mt-1 text-2xl font-bold text-gray-900">
              {plan?.planName ?? "No plan assigned"}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {plan?.planCode ?? "Contact support to assign a plan."}
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
              plan?.status,
            )}`}
          >
            {plan?.status ?? "MISSING"}
          </span>
        </div>

        {!summary.hasActiveAccess ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <h3 className="text-sm font-semibold text-red-900">
              Workspace access needs attention
            </h3>
            <p className="mt-1 text-sm text-red-800">
              Your current plan is not active. Please renew, upgrade, or contact
              support to restore workspace access.
            </p>
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Access</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {summary.hasActiveAccess ? "Active" : "Blocked"}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Trial Ends</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {formatDate(plan?.trialEndsAt)}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Period Start</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {formatDate(plan?.currentPeriodStartsAt)}
            </p>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <p className="text-sm text-gray-500">Period End</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {formatDate(plan?.currentPeriodEndsAt)}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard/billing/upgrade"
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Upgrade Plan
          </Link>
          <Link
            href="/dashboard/billing"
            className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-900"
          >
            Open Billing
          </Link>
        </div>
      </section>
    </main>
  );
}
