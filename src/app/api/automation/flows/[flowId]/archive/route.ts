import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  archiveAutomationFlow,
  AutomationFlowNotFoundError,
} from "@/server/services/automation-versioning.service";

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

    const { flowId } = await params;
    const flow = await archiveAutomationFlow(
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
    if (error instanceof AutomationFlowNotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    console.error("AUTOMATION_ARCHIVE_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to archive automation flow" },
      { status: 500 },
    );
  }
}
