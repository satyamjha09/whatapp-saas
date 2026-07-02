import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  AutomationTestValidationError,
  startAutomationTestRun,
} from "@/server/services/automation-test-runner.service";
import {
  automationFlowTestParamsSchema,
  startAutomationTestSchema,
} from "@/server/validators/automation-test.validator";

export async function POST(
  request: Request,
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

    const resolvedParams = await params;
    const paramValidation =
      automationFlowTestParamsSchema.safeParse(resolvedParams);

    if (!paramValidation.success) {
      return NextResponse.json(
        { message: "Invalid automation flow ID" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validation = startAutomationTestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid test input",
        },
        { status: 400 },
      );
    }

    const testRun = await startAutomationTestRun({
      companyId: context.membership.companyId,
      flowId: paramValidation.data.flowId,
      input: validation.data,
      userId: context.user.id,
    });

    return NextResponse.json({ testRun });
  } catch (error) {
    if (error instanceof AutomationTestValidationError) {
      return NextResponse.json(
        {
          errors: error.validationErrors,
          message: error.message,
          warnings: error.validationWarnings,
        },
        { status: 400 },
      );
    }

    console.error("AUTOMATION_TEST_START_ERROR:", error);

    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to start test" },
      { status: 500 },
    );
  }
}
