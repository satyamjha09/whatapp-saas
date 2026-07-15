import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { assertTenantEntityAccess } from "@/server/auth/tenant-guard";
import { createAuditLog } from "@/server/services/audit.service";
import { markInboxAiContextStale } from "@/server/services/inbox-ai-context.service";
import { submitInboxReply } from "@/server/services/inbox-reply-submission.service";
import { UsageQuotaExceededError } from "@/server/services/usage-quota.service";
import {
  assertSystemWritesAllowed,
  SystemMaintenanceModeError,
} from "@/server/services/system-maintenance-mode.service";
import { createTenantErrorResponse } from "@/server/utils/api-tenant-error";
import { createUsageQuotaErrorResponse } from "@/server/utils/api-usage-quota-error";
import { createInboxReplySchema } from "@/server/validators/inbox-reply.validator";

type InboxReplyRouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: InboxReplyRouteContext,
) {
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
    const validation = createInboxReplySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid reply",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    await assertSystemWritesAllowed({
      operation: "Sending replies",
    });

    const { contactId } = await params;
    try {
      await assertTenantEntityAccess({
        request,
        companyId: context.membership.companyId,
        entityType: "Contact",
        entityId: contactId,
      });
    } catch (error) {
      return createTenantErrorResponse(error);
    }

    const result = await submitInboxReply({
      companyId: context.membership.companyId,
      contactId,
      actorUserId: context.user.id,
      input: validation.data,
    });

    if (result.status === "QUEUED") {
      await markInboxAiContextStale({
        companyId: context.membership.companyId,
        contactId,
        reason: "outbound_reply_created",
      }).catch((error) => {
        console.error("INBOX_AI_STALE_MARK_ERROR:", error);
      });
    }

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action:
        result.status === "QUEUED"
          ? "inbox.reply.queued"
          : "inbox.reply.submitted_for_approval",
      entityType: result.status === "QUEUED" ? "Message" : "InboxReplyApproval",
      entityId: result.status === "QUEUED" ? result.message.id : result.approval.id,
      metadata: {
        contactId,
        approvalRequired: result.approvalRequired,
      },
    });

    if (result.status === "PENDING_APPROVAL") {
      return NextResponse.json(
        {
          message: "Reply submitted for approval",
          data: result.approval,
          approvalRequired: true,
        },
        { status: 202 },
      );
    }

    return NextResponse.json(
      {
        message: "Reply queued successfully",
        data: result.message,
        approvalRequired: false,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_INBOX_REPLY_ERROR:", error);

    if (error instanceof SystemMaintenanceModeError) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    if (error instanceof UsageQuotaExceededError) {
      return createUsageQuotaErrorResponse(error);
    }

    if (error instanceof Error && error.message === "Contact not found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    if (error instanceof Error && error.message === "Subscription is past due") {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    if (
      error instanceof Error &&
      error.message === "Complete company onboarding first"
    ) {
      return NextResponse.json({ message: error.message }, { status: 403 });
    }

    if (
      error instanceof Error &&
      error.message === "Customer service window has expired"
    ) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    if (
      error instanceof Error &&
      error.message === "Contact has opted out or is blocked"
    ) {
      return NextResponse.json({ message: error.message }, { status: 409 });
    }

    if (
      error instanceof Error &&
      error.message.startsWith("Monthly message limit exceeded")
    ) {
      return NextResponse.json({ message: error.message }, { status: 402 });
    }

    return NextResponse.json(
      { message: "Unable to queue reply" },
      { status: 500 },
    );
  }
}
