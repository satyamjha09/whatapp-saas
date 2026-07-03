import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getPublishRequestById } from "@/server/services/automation-publish-approval.service";

export async function GET(
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
    const request = await getPublishRequestById(
      context.membership.companyId,
      requestId,
      context.user.id
    );

    return NextResponse.json({ request });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("GET_PUBLISH_REQUEST_ERROR:", err);

    if (err.name === "PublishRequestNotFoundError") {
      return NextResponse.json({ message: err.message }, { status: 404 });
    }

    if (err.name === "AutomationPermissionDeniedError") {
      return NextResponse.json({ message: err.message }, { status: 403 });
    }

    return NextResponse.json(
      { message: "Unable to retrieve publish request details." },
      { status: 500 }
    );
  }
}
