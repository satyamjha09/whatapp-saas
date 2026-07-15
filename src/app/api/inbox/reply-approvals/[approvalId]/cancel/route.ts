import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { cancelInboxReplyApproval } from "@/server/services/inbox-reply-approval.service";
import { cancelInboxReplyApprovalSchema } from "@/server/validators/inbox-reply-approval.validator";

type RouteContext = {
  params: Promise<{
    approvalId: string;
  }>;
};

export async function POST(request: Request, { params }: RouteContext) {
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

    const body: unknown = await request.json().catch(() => ({}));
    const validation = cancelInboxReplyApprovalSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid cancellation",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { approvalId } = await params;
    const approval = await cancelInboxReplyApproval({
      companyId: context.membership.companyId,
      approvalId,
      actorUserId: context.user.id,
      reason: validation.data.reason,
    });

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "inbox.reply_approval.cancelled",
      entityType: "InboxReplyApproval",
      entityId: approval.id,
      metadata: {
        reason: validation.data.reason ?? null,
      },
    });

    return NextResponse.json({ data: approval });
  } catch (error) {
    console.error("CANCEL_INBOX_REPLY_APPROVAL_ERROR:", error);

    if (error instanceof Error) {
      const status = [
        "Approval request not found",
        "Approval request is no longer pending",
        "Only the requester can cancel this approval",
      ].includes(error.message)
        ? 409
        : 500;

      return NextResponse.json({ message: error.message }, { status });
    }

    return NextResponse.json(
      { message: "Unable to cancel reply approval" },
      { status: 500 },
    );
  }
}
