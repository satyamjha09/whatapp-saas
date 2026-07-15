import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { listInboxReplyApprovals } from "@/server/services/inbox-reply-approval.service";
import { listInboxReplyApprovalsQuerySchema } from "@/server/validators/inbox-reply-approval.validator";

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const validation = listInboxReplyApprovalsQuerySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
  });

  if (!validation.success) {
    return NextResponse.json(
      {
        message: "Invalid approval filter",
        errors: validation.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const approvals = await listInboxReplyApprovals({
    companyId: context.membership.companyId,
    status: validation.data.status,
  });

  return NextResponse.json({ data: approvals });
}
