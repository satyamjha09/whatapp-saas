import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { approveInboxReplyApproval } from "@/server/services/inbox-reply-approval.service";
import {
  assertSystemWritesAllowed,
  SystemMaintenanceModeError,
} from "@/server/services/system-maintenance-mode.service";
import { UsageQuotaExceededError } from "@/server/services/usage-quota.service";
import { createUsageQuotaErrorResponse } from "@/server/utils/api-usage-quota-error";

type RouteContext = {
  params: Promise<{
    approvalId: string;
  }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!context.membership) {
      return NextResponse.json(
        { message: "Complete company onboarding first" },
        { status: 403 },
      );
    }

    await assertSystemWritesAllowed({
      operation: "Approving inbox replies",
    });

    const { approvalId } = await params;
    const approval = await approveInboxReplyApproval({
      companyId: context.membership.companyId,
      approvalId,
      reviewedByUserId: context.user.id,
    });

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "inbox.reply_approval.approved",
      entityType: "InboxReplyApproval",
      entityId: approval.id,
      metadata: {
        status: approval.status,
        messageId: approval.messageId,
      },
    });

    return NextResponse.json({ data: approval });
  } catch (error) {
    console.error("APPROVE_INBOX_REPLY_APPROVAL_ERROR:", error);

    if (error instanceof SystemMaintenanceModeError) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    if (error instanceof UsageQuotaExceededError) {
      return createUsageQuotaErrorResponse(error);
    }

    if (error instanceof Error) {
      const status = [
        "Approval request not found",
        "Approval request is no longer pending",
        "Customer service window has expired",
        "Contact has opted out or is blocked",
      ].includes(error.message)
        ? 409
        : error.message === "Insufficient wallet balance"
          ? 402
          : 500;

      return NextResponse.json({ message: error.message }, { status });
    }

    return NextResponse.json(
      { message: "Unable to approve reply" },
      { status: 500 },
    );
  }
}
