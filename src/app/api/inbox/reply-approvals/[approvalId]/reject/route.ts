import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { rejectInboxReplyApproval } from "@/server/services/inbox-reply-approval.service";
import { rejectInboxReplyApprovalSchema } from "@/server/validators/inbox-reply-approval.validator";

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

    const body: unknown = await request.json();
    const validation = rejectInboxReplyApprovalSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid rejection",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { approvalId } = await params;
    const approval = await rejectInboxReplyApproval({
      companyId: context.membership.companyId,
      approvalId,
      reviewedByUserId: context.user.id,
      reason: validation.data.reason,
    });

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "inbox.reply_approval.rejected",
      entityType: "InboxReplyApproval",
      entityId: approval.id,
      metadata: {
        reason: validation.data.reason,
      },
    });

    return NextResponse.json({ data: approval });
  } catch (error) {
    console.error("REJECT_INBOX_REPLY_APPROVAL_ERROR:", error);

    if (error instanceof Error) {
      const status = [
        "Approval request not found",
        "Approval request is no longer pending",
      ].includes(error.message)
        ? 409
        : 500;

      return NextResponse.json({ message: error.message }, { status });
    }

    return NextResponse.json(
      { message: "Unable to reject reply" },
      { status: 500 },
    );
  }
}
