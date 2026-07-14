import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { cloneBroadcastDraft } from "@/server/services/broadcast-launch-control.service";

type BroadcastDraftCloneRouteContext = {
  params: Promise<{ draftId: string }>;
};

function canManageBroadcasts(role?: string) {
  return role === "OWNER" || role === "ADMIN";
}

export async function POST(
  _request: Request,
  { params }: BroadcastDraftCloneRouteContext,
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

    if (!canManageBroadcasts(context.membership.role)) {
      return NextResponse.json(
        { message: "You do not have permission to clone broadcasts" },
        { status: 403 },
      );
    }

    const { draftId } = await params;
    const result = await cloneBroadcastDraft({
      actorUserId: context.user.id,
      companyId: context.membership.companyId,
      draftId,
    });

    return NextResponse.json({
      ...result,
      message: "Broadcast draft cloned",
    });
  } catch (error) {
    console.error("BROADCAST_DRAFT_CLONE_ERROR:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to clone broadcast draft",
      },
      { status: 500 },
    );
  }
}
