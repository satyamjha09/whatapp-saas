import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import {
  addTagToConversation,
  removeTagFromConversation,
} from "@/server/services/inbox-tag.service";
import { addConversationTagSchema } from "@/server/validators/inbox-tag.validator";

type AddConversationTagRouteContext = {
  params: Promise<{
    contactId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: AddConversationTagRouteContext,
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
    const validation = addConversationTagSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid tag",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { contactId } = await params;

    const contactTag = await addTagToConversation(
      context.membership.companyId,
      contactId,
      validation.data,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "inbox.conversation_tag.added",
      entityType: "Contact",
      entityId: contactId,
      metadata: {
        tagId: contactTag.tagId,
        tagName: contactTag.tag.name,
      },
    });

    return NextResponse.json(
      {
        message: "Tag added successfully",
        contactTag,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("ADD_CONVERSATION_TAG_ERROR:", error);

    if (
      error instanceof Error &&
      ["Contact not found", "Tag not found"].includes(error.message)
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to add tag" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: AddConversationTagRouteContext,
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
    const tagId = new URL(request.url).searchParams.get("tagId");

    if (!tagId) {
      return NextResponse.json({ message: "Tag is required" }, { status: 400 });
    }

    const contactTag = await removeTagFromConversation(
      context.membership.companyId,
      contactId,
      tagId,
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
