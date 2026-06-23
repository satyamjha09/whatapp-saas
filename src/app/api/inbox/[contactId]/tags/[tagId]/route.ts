import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { removeTagFromConversation } from "@/server/services/inbox-tag.service";

type RemoveConversationTagRouteContext = {
  params: Promise<{
    contactId: string;
    tagId: string;
  }>;
};

export async function DELETE(
  _request: Request,
  { params }: RemoveConversationTagRouteContext,
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

    const { contactId, tagId } = await params;

    const contactTag = await removeTagFromConversation(
      context.membership.companyId,
      contactId,
      tagId,
      context.user.id,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "inbox.conversation_tag.removed",
      entityType: "Contact",
      entityId: contactId,
      metadata: {
        tagId: contactTag.tagId,
        tagName: contactTag.tag.name,
      },
    });

    return NextResponse.json({
      message: "Tag removed successfully",
    });
  } catch (error) {
    console.error("REMOVE_CONVERSATION_TAG_ERROR:", error);

    if (
      error instanceof Error &&
      error.message === "Conversation tag not found"
    ) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Unable to remove tag" },
      { status: 500 },
    );
  }
}
