import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createPublishRequest } from "@/server/services/automation-publish-approval.service";
import { CreatePublishRequestInputSchema } from "@/server/validators/automation-publish-approval.validator";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ flowId: string }> }
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

    const { flowId } = await params;
    const body = await request.json().catch(() => ({}));
    const result = CreatePublishRequestInputSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: "Invalid publish request parameters", errors: result.error.flatten() },
        { status: 400 }
      );
    }

    const publishRequest = await createPublishRequest(
      context.membership.companyId,
      flowId,
      context.user.id,
      result.data
    );

    return NextResponse.json({ publishRequest }, { status: 201 });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("CREATE_PUBLISH_REQUEST_ERROR:", err);

    if (err.name === "AutomationPermissionDeniedError") {
      return NextResponse.json({ message: err.message }, { status: 403 });
    }

    if (err.name === "InvalidPublishRequestStateError") {
      return NextResponse.json({ message: err.message }, { status: 400 });
    }

    return NextResponse.json(
      { message: "Unable to submit publish approval request." },
      { status: 500 }
    );
  }
}
