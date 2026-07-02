import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getAutomationExecutionDetail } from "@/server/services/automation-execution-log.service";
import { automationExecutionDetailParamsSchema } from "@/server/validators/automation-analytics.validator";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ executionId: string }> },
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

    const parsedParams = automationExecutionDetailParamsSchema.safeParse(
      await params,
    );

    if (!parsedParams.success) {
      return NextResponse.json(
        {
          errors: parsedParams.error.flatten().fieldErrors,
          message: "Invalid execution ID",
        },
        { status: 400 },
      );
    }

    const result = await getAutomationExecutionDetail(
      context.membership.companyId,
      parsedParams.data.executionId,
    );

    if (!result) {
      return NextResponse.json(
        { message: "Automation execution was not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("AUTOMATION_EXECUTION_DETAIL_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to load automation execution" },
      { status: 500 },
    );
  }
}
