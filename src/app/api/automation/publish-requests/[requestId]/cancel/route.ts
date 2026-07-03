import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { cancelPublishRequest } from "@/server/services/automation-publish-approval.service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!context.membership) {
      return NextResponse.json(
        { message: "Complete company onboarding first" },
        { status: 403 }
      );
    }

    const { requestId } = await params;
    const updatedRequest = await cancelPublishRequest(
      context.membership.companyId,
      requestId,
      context.user.id
    );

    return NextResponse.json({ request: updatedRequest });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("CANCEL_PUBLISH_REQUEST_ERROR:", err);

    if (err.name === "PublishRequestNotFoundError") {
      return NextResponse.json({ message: err.message }, { status: 404 });
    }

    if (err.name === "InvalidPublishRequestStateError") {
      return NextResponse.json({ message: err.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to cancel publish request." },
      { status: 500 }
    );
  }
}
