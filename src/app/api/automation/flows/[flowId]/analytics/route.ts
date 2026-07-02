import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getFlowAnalytics } from "@/server/services/automation-analytics.service";
import { automationFlowAnalyticsQuerySchema } from "@/server/validators/automation-analytics.validator";

export async function GET(
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

    const url = new URL(request.url);
    const validation = automationFlowAnalyticsQuerySchema.safeParse(
      Object.fromEntries(url.searchParams),
    );

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid automation analytics filters",
        },
        { status: 400 },
      );
    }

    const { flowId } = await params;
    const analytics = await getFlowAnalytics(
      context.membership.companyId,
      flowId,
      validation.data,
    );

    if (!analytics) {
      return NextResponse.json(
        { message: "Automation flow was not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(analytics);
  } catch (error) {
    console.error("AUTOMATION_FLOW_ANALYTICS_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to load automation analytics" },
      { status: 500 },
    );
  }
}
