import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  AutomationFlowNotFoundError,
  listAutomationFlowVersions,
} from "@/server/services/automation-versioning.service";
import {
  assertAutomationApiPermission,
  createAutomationPermissionErrorResponse,
} from "@/server/utils/automation-api-permission";

export async function GET(
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
      permission: "automation.flow.view",
      userId: context.user.id,
    });

    const { flowId } = await params;
    const result = await listAutomationFlowVersions(
      context.membership.companyId,
      flowId,
    );

    return NextResponse.json({
      flow: {
        id: result.flow.id,
        publishedVersionId: result.flow.publishedVersionId,
        status: result.flow.status,
      },
      versions: result.versions,
    });
  } catch (error) {
    const permissionError = createAutomationPermissionErrorResponse(error);
    if (permissionError) return permissionError;

    if (error instanceof AutomationFlowNotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    console.error("AUTOMATION_VERSIONS_LIST_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to list automation versions" },
      { status: 500 },
    );
  }
}
