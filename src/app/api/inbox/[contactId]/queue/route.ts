import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  assertRoutePermission,
  createRoutePermissionErrorResponse,
} from "@/server/auth/route-permission-guard";
import { createAuditLog } from "@/server/services/audit.service";
import { updateConversationQueue } from "@/server/services/inbox-queue.service";
import { updateConversationQueueSchema } from "@/server/validators/inbox-queue.validator";

type UpdateConversationQueueRouteContext = {
  params: Promise<{ contactId: string }>;
};

export async function PATCH(
  request: Request,
  { params }: UpdateConversationQueueRouteContext,
) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!context.membership) {
      return NextResponse.json({ message: "Complete company onboarding first" }, { status: 403 });
    }

    await assertRoutePermission({ request, workspace: context });

    const body: unknown = await request.json();
    const validation = updateConversationQueueSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { message: "Invalid queue", errors: validation.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { contactId } = await params;
    const contact = await updateConversationQueue(
      context.membership.companyId,
      contactId,
      validation.data,
      context.user.id,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "inbox.conversation_queue.updated",
      entityType: "Contact",
      entityId: contact.id,
      metadata: {
        inboxQueueId: contact.inboxQueueId,
        inboxAssignmentSource: contact.inboxAssignmentSource,
      },
    });

    return NextResponse.json({
      message: "Conversation queue updated successfully",
      contact,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("permission")) {
      return createRoutePermissionErrorResponse(error);
    }

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to update conversation queue" },
      { status: 400 },
    );
  }
}
