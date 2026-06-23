import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { assertTenantEntityAccess } from "@/server/auth/tenant-guard";
import { createAuditLog } from "@/server/services/audit.service";
import { createQueuedInboxReply } from "@/server/services/message.service";
import {
  assertSystemWritesAllowed,
  SystemMaintenanceModeError,
} from "@/server/services/system-maintenance-mode.service";
import { createTenantErrorResponse } from "@/server/utils/api-tenant-error";
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

    const message = await createQueuedInboxReply(
      context.membership.companyId,
      contactId,
      validation.data,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "inbox.reply.queued",
      entityType: "Message",
      entityId: message.id,
      metadata: {
        contactId,
      },
    });

    return NextResponse.json(
      {
        message: "Reply queued successfully",
        data: message,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_INBOX_REPLY_ERROR:", error);

    if (error instanceof SystemMaintenanceModeError) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }

    if (error instanceof Error && error.message === "Contact not found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    if (error instanceof Error && error.message === "Subscription is past due") {
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
