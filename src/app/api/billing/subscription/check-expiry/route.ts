import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { runSubscriptionExpiryJob } from "@/server/jobs/subscription-expiry.job";
import { createAuditLog } from "@/server/services/audit.service";

export async function POST() {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!context.membership) {
      return NextResponse.json({ message: "Complete company onboarding first" }, { status: 403 });
    }
    if (!["OWNER", "ADMIN"].includes(context.membership.role)) {
      return NextResponse.json(
        { message: "Only owners and admins can run subscription checks" },
        { status: 403 },
      );
    }

    const result = await runSubscriptionExpiryJob({
      companyId: context.membership.companyId,
      limit: 1,
    });
    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "billing.subscription.expiry_checked",
      entityType: "Company",
      entityId: context.membership.companyId,
      metadata: {
        checkedCount: result.checkedCount,
        updatedCount: result.recoveredCount,
      },
    });

    return NextResponse.json({
      message: "Subscription expiry check completed",
      result,
    });
  } catch (error) {
    console.error("SUBSCRIPTION_EXPIRY_CHECK_ERROR:", error);
    return NextResponse.json(
      { message: "Unable to run subscription expiry check" },
      { status: 500 },
    );
  }
}
