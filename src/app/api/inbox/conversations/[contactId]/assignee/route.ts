import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { updateConversationAssignee } from "@/server/services/inbox.service";
import { updateConversationAssigneeSchema } from "@/server/validators/inbox-assignee.validator";

type UpdateConversationAssigneeRouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

export async function PATCH(
  request: Request,
  { params }: UpdateConversationAssigneeRouteContext,
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

    const { contactId } = await params;
    const body: unknown = await request.json();
    const validation = updateConversationAssigneeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid assignee update",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const contact = await updateConversationAssignee(
      context.membership.companyId,
      contactId,
      validation.data,
      context.user.id,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: validation.data.assignedToUserId
        ? "inbox.conversation.assigned"
        : "inbox.conversation.unassigned",
      entityType: "Contact",
      entityId: contact.id,
      metadata: {
        assignedToUserId: contact.assignedToUserId,
      },
    });

    return NextResponse.json({
      message: "Conversation assignee updated",
      contact,
    });
  } catch (error) {
    console.error("UPDATE_CONVERSATION_ASSIGNEE_ERROR:", error);

    if (
      error instanceof Error &&
      ["Contact not found", "Assigned user is not a member of this company"].includes(
        error.message,
      )
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to update conversation assignee" },
      { status: 500 },
    );
  }
}
