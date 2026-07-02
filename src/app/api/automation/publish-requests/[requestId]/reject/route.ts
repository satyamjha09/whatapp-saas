import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { rejectPublishRequest } from "@/server/services/automation-publish-approval.service";
import { RejectPublishRequestInputSchema } from "@/server/validators/automation-publish-approval.validator";

export async function POST(
  request: Request,
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
    const body = await request.json().catch(() => ({}));
    const result = RejectPublishRequestInputSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: "Invalid rejection parameters", errors: result.error.flatten() },
        { status: 400 }
      );
    }

    const updatedRequest = await rejectPublishRequest(
      context.membership.companyId,
      requestId,
      context.user.id,
      result.data
    );

    return NextResponse.json({ request: updatedRequest });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("REJECT_PUBLISH_REQUEST_ERROR:", err);

    if (err.name === "AutomationPermissionDeniedError") {
      return NextResponse.json({ message: err.message }, { status: 403 });
    }

    if (err.name === "PublishRequestNotFoundError") {
      return NextResponse.json({ message: err.message }, { status: 404 });
    }

    if (err.name === "InvalidPublishRequestStateError") {
      return NextResponse.json({ message: err.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to reject publish request." },
      { status: 500 }
    );
  }
}
