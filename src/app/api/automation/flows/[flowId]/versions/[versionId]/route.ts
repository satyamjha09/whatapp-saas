import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  AutomationFlowNotFoundError,
  getAutomationFlowVersion,
} from "@/server/services/automation-versioning.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ flowId: string; versionId: string }> },
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

    const { flowId, versionId } = await params;
    const result = await getAutomationFlowVersion(
      context.membership.companyId,
      flowId,
      versionId,
    );

    return NextResponse.json({
      graph: result.graph,
      isCurrentPublished: result.isCurrentPublished,
      version: {
        id: result.version.id,
        isRollback: result.version.isRollback,
        publishedAt: result.version.publishedAt,
        publishedByUserId: result.version.publishedByUserId,
        publishNotes: result.version.publishNotes,
        rollbackFromVersionId: result.version.rollbackFromVersionId,
        validationSnapshot: result.version.validationSnapshot,
        versionNumber: result.version.versionNumber,
      },
    });
  } catch (error) {
    if (error instanceof AutomationFlowNotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    console.error("AUTOMATION_VERSION_GET_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to load automation version" },
      { status: 500 },
    );
  }
}
