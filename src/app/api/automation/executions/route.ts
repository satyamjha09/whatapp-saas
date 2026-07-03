import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getAutomationExecutionList } from "@/server/services/automation-execution-log.service";
import { automationExecutionListQuerySchema } from "@/server/validators/automation-analytics.validator";
import {
  assertAutomationApiPermission,
  createAutomationPermissionErrorResponse,
} from "@/server/utils/automation-api-permission";

export async function GET(request: Request) {
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
      permission: "automation.execution.view",
      userId: context.user.id,
    });

    const url = new URL(request.url);
    const validation = automationExecutionListQuerySchema.safeParse(
      Object.fromEntries(url.searchParams),
    );

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid execution log filters",
        },
        { status: 400 },
      );
    }

    const result = await getAutomationExecutionList(
      context.membership.companyId,
      validation.data,
    );

    return NextResponse.json(result);
  } catch (error) {
    const permissionError = createAutomationPermissionErrorResponse(error);
    if (permissionError) return permissionError;

    console.error("AUTOMATION_EXECUTIONS_LIST_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to load automation executions" },
      { status: 500 },
    );
  }
}
