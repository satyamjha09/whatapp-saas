import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { runBroadcastDraftPreflight } from "@/server/services/broadcast-preflight.service";

type BroadcastDraftPreflightRouteContext = {
  params: Promise<{
    draftId: string;
  }>;
};

function canManageBroadcasts(role?: string) {
  return role === "OWNER" || role === "ADMIN";
}

export async function POST(
  _request: Request,
  { params }: BroadcastDraftPreflightRouteContext,
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
        { message: "You do not have permission to manage broadcasts" },
        { status: 403 },
      );
    }

    const { draftId } = await params;
    const preflight = await runBroadcastDraftPreflight({
      companyId: context.membership.companyId,
      draftId,
    });

    return NextResponse.json({ preflight });
  } catch (error) {
    console.error("BROADCAST_DRAFT_PREFLIGHT_ERROR:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to run broadcast preflight",
      },
      { status: 500 },
    );
  }
}
