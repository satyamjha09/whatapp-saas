import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  cancelAutomationTestRun,
  getAutomationTestRun,
} from "@/server/services/automation-test-runner.service";
import { automationTestRunParamsSchema } from "@/server/validators/automation-test.validator";
import {
  assertAutomationApiPermission,
  createAutomationPermissionErrorResponse,
} from "@/server/utils/automation-api-permission";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ flowId: string; testRunId: string }> },
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
      permission: "automation.flow.test",
      userId: context.user.id,
    });

    const resolvedParams = await params;
    const validation = automationTestRunParamsSchema.safeParse(resolvedParams);

    if (!validation.success) {
      return NextResponse.json(
        { message: "Invalid test run ID" },
        { status: 400 },
      );
    }

    const testRun = await getAutomationTestRun({
      companyId: context.membership.companyId,
      flowId: validation.data.flowId,
      testRunId: validation.data.testRunId,
    });

    if (!testRun) {
      return NextResponse.json(
        { message: "Test run not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ testRun });
  } catch (error) {
    const permissionError = createAutomationPermissionErrorResponse(error);
    if (permissionError) return permissionError;

    console.error("AUTOMATION_TEST_GET_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch automation test" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ flowId: string; testRunId: string }> },
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
      permission: "automation.flow.test",
      userId: context.user.id,
    });

    const resolvedParams = await params;
    const validation = automationTestRunParamsSchema.safeParse(resolvedParams);

    if (!validation.success) {
      return NextResponse.json(
        { message: "Invalid test run ID" },
        { status: 400 },
      );
    }

    const testRun = await cancelAutomationTestRun({
      companyId: context.membership.companyId,
      flowId: validation.data.flowId,
      testRunId: validation.data.testRunId,
    });

    if (!testRun) {
      return NextResponse.json(
        { message: "Test run not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ testRun });
  } catch (error) {
    const permissionError = createAutomationPermissionErrorResponse(error);
    if (permissionError) return permissionError;

    console.error("AUTOMATION_TEST_DELETE_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to cancel automation test" },
      { status: 500 },
    );
  }
}
