import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getFlowAnalytics } from "@/server/services/automation-analytics.service";
import { getCompanyPlanFeatures } from "@/server/services/plan-feature.service";
import { automationFlowAnalyticsQuerySchema } from "@/server/validators/automation-analytics.validator";
import {
  assertAutomationApiPermission,
  createAutomationPermissionErrorResponse,
} from "@/server/utils/automation-api-permission";

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

    await assertAutomationApiPermission({
      companyId: context.membership.companyId,
      permission: "automation.analytics.view",
      userId: context.user.id,
    });

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

    const features = await getCompanyPlanFeatures(context.membership.companyId);
    if (!features.advancedAnalytics) {
      return NextResponse.json({
        ...analytics,
        advancedAnalyticsLocked: true,
        dropOffNodes: [],
        nodeAnalytics: [],
        topFailedNodes: [],
        topTriggerKeywords: [],
        versionBreakdown: [],
      });
    }

    return NextResponse.json(analytics);
  } catch (error) {
    const permissionError = createAutomationPermissionErrorResponse(error);
    if (permissionError) return permissionError;

    console.error("AUTOMATION_FLOW_ANALYTICS_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to load automation analytics" },
      { status: 500 },
    );
  }
}
