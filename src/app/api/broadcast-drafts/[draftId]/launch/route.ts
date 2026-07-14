import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { requestBroadcastLaunch } from "@/server/services/broadcast-launch-control.service";
import { broadcastLaunchControlSchema } from "@/server/validators/broadcast-draft.validator";

type BroadcastDraftLaunchRouteContext = {
  params: Promise<{ draftId: string }>;
};

function canManageBroadcasts(role?: string) {
  return role === "OWNER" || role === "ADMIN";
}

export async function POST(
  request: Request,
  { params }: BroadcastDraftLaunchRouteContext,
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
        { message: "You do not have permission to launch broadcasts" },
        { status: 403 },
      );
    }

    const validation = broadcastLaunchControlSchema.safeParse(
      await request.json(),
    );

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid launch controls",
        },
        { status: 400 },
      );
    }

    const { draftId } = await params;
    const result = await requestBroadcastLaunch({
      actorUserId: context.user.id,
      companyId: context.membership.companyId,
      draftId,
      input: validation.data,
    });

    return NextResponse.json({
      ...result,
      message:
        validation.data.action === "SCHEDULE_LATER"
          ? "Broadcast scheduled safely"
          : "Broadcast queued for runtime sending",
    });
  } catch (error) {
    console.error("BROADCAST_DRAFT_LAUNCH_ERROR:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to update broadcast launch controls",
      },
      { status: 500 },
    );
  }
}
