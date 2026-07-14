import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { updateBroadcastLaunchControl } from "@/server/services/broadcast-launch-control.service";

type BroadcastDraftControlRouteContext = {
  params: Promise<{ draftId: string }>;
};

const controlSchema = z.object({
  action: z.enum(["PAUSE", "RESUME", "CANCEL"]),
});

function canManageBroadcasts(role?: string) {
  return role === "OWNER" || role === "ADMIN";
}

export async function POST(
  request: Request,
  { params }: BroadcastDraftControlRouteContext,
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
        { message: "You do not have permission to control broadcasts" },
        { status: 403 },
      );
    }

    const validation = controlSchema.safeParse(await request.json());
    if (!validation.success) {
      return NextResponse.json(
        { message: "Invalid broadcast control action" },
        { status: 400 },
      );
    }

    const { draftId } = await params;
    const result = await updateBroadcastLaunchControl({
      action: validation.data.action,
      actorUserId: context.user.id,
      companyId: context.membership.companyId,
      draftId,
    });

    return NextResponse.json({
      ...result,
      message: "Broadcast control updated",
    });
  } catch (error) {
    console.error("BROADCAST_DRAFT_CONTROL_ERROR:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to update broadcast control",
      },
      { status: 500 },
    );
  }
}
