import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import { deleteInboxSavedView } from "@/server/services/inbox-saved-view.service";

type SavedViewRouteContext = {
  params: Promise<{
    savedViewId: string;
  }>;
};

export async function DELETE(
  _request: Request,
  { params }: SavedViewRouteContext,
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

    const { savedViewId } = await params;

    await deleteInboxSavedView({
      companyId: context.membership.companyId,
      userId: context.user.id,
      savedViewId,
    });

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "inbox.saved_view_deleted",
      entityType: "InboxSavedView",
      entityId: savedViewId,
    });

    return NextResponse.json({
      message: "Saved view deleted successfully",
    });
  } catch (error) {
    console.error("DELETE_INBOX_SAVED_VIEW_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to delete saved view" },
      { status: 500 },
    );
  }
}
