import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  AutomationFlowNotFoundError,
  AutomationPublishBlockedError,
  resumeAutomationFlow,
} from "@/server/services/automation-versioning.service";
import {
  assertAutomationApiPermission,
  createAutomationPermissionErrorResponse,
} from "@/server/utils/automation-api-permission";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ flowId: string }> },
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

    await assertAutomationApiPermission({
      companyId: context.membership.companyId,
      permission: "automation.flow.resume",
      userId: context.user.id,
    });

    const { flowId } = await params;
    const flow = await resumeAutomationFlow(
      context.membership.companyId,
      flowId,
      context.user.id,
    );

    return NextResponse.json({
      flow: {
        id: flow.id,
        status: flow.status,
      },
    });
  } catch (error) {
    const permissionError = createAutomationPermissionErrorResponse(error);
    if (permissionError) return permissionError;

    if (error instanceof AutomationFlowNotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    if (error instanceof AutomationPublishBlockedError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.statusCode },
      );
    }

    console.error("AUTOMATION_RESUME_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to resume automation flow" },
      { status: 500 },
    );
  }
}
