import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { cancelSubscriptionAtPeriodEnd } from "@/server/services/subscription-cancellation.service";

const knownErrors = new Set([
  "Company not found",
  "Free plan cannot be canceled",
  "Only active paid subscriptions can be canceled",
  "Subscription cancellation is already scheduled",
  "Current billing period not found",
]);

export async function POST() {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!context.membership) {
      return NextResponse.json({ message: "Complete company onboarding first" }, { status: 403 });
    }
    if (!["OWNER", "ADMIN"].includes(context.membership.role)) {
      return NextResponse.json(
        { message: "Only owners and admins can cancel subscriptions" },
        { status: 403 },
      );
    }

    const company = await cancelSubscriptionAtPeriodEnd(
      context.membership.companyId,
    );
    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "billing.subscription.cancel_at_period_end",
      entityType: "Company",
      entityId: context.membership.companyId,
      metadata: {
        billingPlan: company.billingPlan,
        currentPeriodEnd: company.currentPeriodEnd?.toISOString() ?? "",
      },
    });

    return NextResponse.json({
      message: "Subscription will cancel at period end",
      company,
    });
  } catch (error) {
    console.error("CANCEL_SUBSCRIPTION_ERROR:", error);
    const message = error instanceof Error ? error.message : "";
    if (knownErrors.has(message)) {
      return NextResponse.json({ message }, { status: 400 });
    }
    return NextResponse.json({ message: "Unable to cancel subscription" }, { status: 500 });
  }
}
