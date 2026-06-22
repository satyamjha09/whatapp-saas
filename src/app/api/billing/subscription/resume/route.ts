import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { resumeCanceledSubscription } from "@/server/services/subscription-cancellation.service";

const knownErrors = new Set([
  "Company not found",
  "Free plan does not need resume",
  "Subscription is not scheduled for cancellation",
  "Cancellation can no longer be resumed",
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
        { message: "Only owners and admins can resume subscriptions" },
        { status: 403 },
      );
    }

    const company = await resumeCanceledSubscription(
      context.membership.companyId,
    );
    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "billing.subscription.resumed",
      entityType: "Company",
      entityId: context.membership.companyId,
      metadata: {
        billingPlan: company.billingPlan,
        currentPeriodEnd: company.currentPeriodEnd?.toISOString() ?? "",
      },
    });

    return NextResponse.json({ message: "Subscription resumed successfully", company });
  } catch (error) {
    console.error("RESUME_SUBSCRIPTION_ERROR:", error);
    const message = error instanceof Error ? error.message : "";
    if (knownErrors.has(message)) {
      return NextResponse.json({ message }, { status: 400 });
    }
    return NextResponse.json({ message: "Unable to resume subscription" }, { status: 500 });
  }
}
