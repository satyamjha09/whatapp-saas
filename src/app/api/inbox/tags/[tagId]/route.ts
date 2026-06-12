import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { deleteInboxTag } from "@/server/services/inbox-tag.service";

type InboxTagRouteContext = {
  params: Promise<{
    tagId: string;
  }>;
};

export async function DELETE(
  _request: Request,
  { params }: InboxTagRouteContext,
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

    const { tagId } = await params;
    const tag = await deleteInboxTag(context.membership.companyId, tagId);

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "inbox.tag.deleted",
      entityType: "InboxTag",
      entityId: tag.id,
      metadata: {
        name: tag.name,
      },
    });

    return NextResponse.json({
      message: "Tag deleted successfully",
    });
  } catch (error) {
    console.error("DELETE_INBOX_TAG_ERROR:", error);

    if (error instanceof Error && error.message === "Tag not found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Unable to delete tag" },
      { status: 500 },
    );
  }
}
