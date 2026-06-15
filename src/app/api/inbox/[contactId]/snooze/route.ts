import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { updateConversationSnooze } from "@/server/services/inbox.service";
import { updateConversationSnoozeSchema } from "@/server/validators/inbox-snooze.validator";

type UpdateConversationSnoozeRouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

export async function PATCH(
  request: Request,
  { params }: UpdateConversationSnoozeRouteContext,
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
    const validation = updateConversationSnoozeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid snooze details",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { contactId } = await params;
    const contact = await updateConversationSnooze(
      context.membership.companyId,
      contactId,
      validation.data,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: validation.data.snoozedUntil
        ? "inbox.conversation.snoozed"
        : "inbox.conversation.unsnoozed",
      entityType: "Contact",
      entityId: contact.id,
      metadata: {
        snoozedUntil: contact.snoozedUntil,
      },
    });

    return NextResponse.json({
      message: validation.data.snoozedUntil
        ? "Conversation snoozed successfully"
        : "Conversation unsnoozed successfully",
      contact,
    });
  } catch (error) {
    console.error("UPDATE_CONVERSATION_SNOOZE_ERROR:", error);

    if (
      error instanceof Error &&
      ["Contact not found", "Snooze time must be in the future"].includes(
        error.message,
      )
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to update conversation snooze" },
      { status: 500 },
    );
  }
}
