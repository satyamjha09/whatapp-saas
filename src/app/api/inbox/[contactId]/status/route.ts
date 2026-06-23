import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { updateConversationStatus } from "@/server/services/inbox.service";
import { updateConversationStatusSchema } from "@/server/validators/inbox-status.validator";

type UpdateConversationStatusRouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

export async function PATCH(
  request: Request,
  { params }: UpdateConversationStatusRouteContext,
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
    const validation = updateConversationStatusSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid conversation status",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { contactId } = await params;

    const contact = await updateConversationStatus(
      context.membership.companyId,
      contactId,
      validation.data,
      context.user.id,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "inbox.conversation_status.updated",
      entityType: "Contact",
      entityId: contact.id,
      metadata: {
        status: contact.inboxStatus,
      },
    });

    return NextResponse.json({
      message: "Conversation status updated successfully",
      contact,
    });
  } catch (error) {
    console.error("UPDATE_CONVERSATION_STATUS_ERROR:", error);

    if (error instanceof Error && error.message === "Contact not found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Unable to update conversation status" },
      { status: 500 },
    );
  }
}
