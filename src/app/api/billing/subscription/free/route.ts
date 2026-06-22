import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { changeWorkspaceToFreePlan } from "@/server/services/razorpay-subscription.service";

export async function POST() {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!context.membership) {
      return NextResponse.json({ message: "Complete company onboarding first" }, { status: 403 });
    }
    if (!["OWNER", "ADMIN"].includes(context.membership.role)) {
      return NextResponse.json(
        { message: "Only owners and admins can change subscription plans" },
        { status: 403 },
      );
    }

    const result = await changeWorkspaceToFreePlan(context.membership.companyId);
    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "billing.subscription.free_plan_selected",
      entityType: "Company",
      entityId: context.membership.companyId,
      metadata: {
        plan: result.plan.id,
        monthlyMessageLimit: result.plan.monthlyMessageLimit,
      },
    });

    return NextResponse.json({ message: "Free plan selected", result });
  } catch (error) {
    console.error("CHANGE_TO_FREE_PLAN_ERROR:", error);
    return NextResponse.json({ message: "Unable to change to free plan" }, { status: 500 });
  }
}
