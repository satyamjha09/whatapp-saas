import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAuditLog } from "@/server/services/audit.service";
import {
  deleteQuickReply,
  updateQuickReply,
} from "@/server/services/quick-reply.service";
import { updateQuickReplySchema } from "@/server/validators/quick-reply.validator";

type QuickReplyRouteContext = {
  params: Promise<{
    quickReplyId: string;
  }>;
};

export async function PATCH(
  request: Request,
  { params }: QuickReplyRouteContext,
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
    const validation = updateQuickReplySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          message: "Invalid quick reply",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const { quickReplyId } = await params;

    const quickReply = await updateQuickReply(
      context.membership.companyId,
      quickReplyId,
      validation.data,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "inbox.quick_reply.updated",
      entityType: "QuickReply",
      entityId: quickReply.id,
      metadata: {
        title: quickReply.title,
      },
    });

    return NextResponse.json({
      message: "Quick reply updated successfully",
      quickReply,
    });
  } catch (error) {
    console.error("UPDATE_QUICK_REPLY_ERROR:", error);

    if (
      error instanceof Error &&
      [
        "Quick reply not found",
        "Quick reply with this title already exists",
      ].includes(error.message)
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to update quick reply" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: QuickReplyRouteContext,
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

    const { quickReplyId } = await params;

    const quickReply = await deleteQuickReply(
      context.membership.companyId,
      quickReplyId,
    );

    await createAuditLog({
      companyId: context.membership.companyId,
      actorUserId: context.user.id,
      action: "inbox.quick_reply.deleted",
      entityType: "QuickReply",
      entityId: quickReply.id,
      metadata: {
        title: quickReply.title,
      },
    });

    return NextResponse.json({
      message: "Quick reply deleted successfully",
    });
  } catch (error) {
    console.error("DELETE_QUICK_REPLY_ERROR:", error);

    if (error instanceof Error && error.message === "Quick reply not found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Unable to delete quick reply" },
      { status: 500 },
    );
  }
}
