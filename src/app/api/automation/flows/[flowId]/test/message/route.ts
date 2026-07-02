import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { continueAutomationTestRun } from "@/server/services/automation-test-runner.service";
import {
  automationFlowTestParamsSchema,
  continueAutomationTestSchema,
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
    const validation = continueAutomationTestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid simulated reply",
        },
        { status: 400 },
      );
    }

    const testRun = await continueAutomationTestRun({
      companyId: context.membership.companyId,
      flowId: paramValidation.data.flowId,
      input: validation.data,
    });

    return NextResponse.json({ testRun });
  } catch (error) {
    console.error("AUTOMATION_TEST_MESSAGE_ERROR:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to continue automation test",
      },
      { status: 400 },
    );
  }
}
