import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { changeSubscriptionPlan } from "@/server/services/subscription.service";
import { changeSubscriptionPlanSchema } from "@/server/validators/subscription.validator";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { message: "Direct plan changes are disabled in production" },
      { status: 403 },
    );
  }

  const context = await getCurrentWorkspaceContext();
  if (!context) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!context.membership || !["OWNER", "ADMIN"].includes(context.membership.role)) {
    return NextResponse.json({ message: "Only owners and admins can change subscription plans" }, { status: 403 });
  }
  const validation = changeSubscriptionPlanSchema.safeParse(await request.json());
  if (!validation.success) {
    return NextResponse.json({ message: "Invalid subscription plan" }, { status: 400 });
  }
  const result = await changeSubscriptionPlan({
    companyId: context.membership.companyId,
    input: validation.data,
  });
  await createAuditLog({
    companyId: context.membership.companyId,
    actorUserId: context.user.id,
    action: "billing.subscription.plan_changed_development",
    entityType: "Company",
    entityId: context.membership.companyId,
    metadata: { plan: result.plan.id },
  });
  return NextResponse.json({ message: "Subscription plan updated", result });
}
