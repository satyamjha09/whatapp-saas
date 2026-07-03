import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  getCompanyPlan,
  getCompanyPlanFeatures,
  getRequiredPlanForNode,
  PLAN_CONFIGS,
} from "@/server/services/plan-feature.service";

export async function GET() {
  try {
    const context = await getCurrentWorkspaceContext();

    if (!context) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!context.membership) {
      return NextResponse.json(
        { message: "Complete company onboarding first" },
        { status: 403 }
      );
    }

    const companyId = context.membership.companyId;
    const planTier = await getCompanyPlan(companyId);
    const features = await getCompanyPlanFeatures(companyId);

    const allKnownNodes = Array.from(
      new Set(Object.values(PLAN_CONFIGS).flatMap((p) => p.allowedNodes))
    );

    const lockedNodes = allKnownNodes
      .filter((nodeType) => !features.allowedNodes.includes(nodeType))
      .map((nodeType) => {
        const reqPlan = getRequiredPlanForNode(nodeType);
        return {
          nodeType,
          requiredPlan: reqPlan,
          reason: `Requires ${reqPlan} plan or higher`,
        };
      });

    return NextResponse.json({
      planName: planTier,
      limits: {
        maxFlows: features.maxFlows,
        maxPublishedFlows: features.maxPublishedFlows,
        monthlyExecutions: features.monthlyExecutions,
        monthlyTestRuns: features.monthlyTestRuns,
        maxVersionsPerFlow: features.maxVersionsPerFlow,
      },
      features: {
        templateLibrary: features.templateLibrary,
        basicAnalytics: features.basicAnalytics,
        advancedAnalytics: features.advancedAnalytics,
        approvalWorkflow: features.approvalWorkflow,
      },
      allowedNodes: features.allowedNodes,
      lockedNodes,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("GET_AUTOMATION_PLAN_LIMITS_ERROR:", err);
    return NextResponse.json(
      { message: "Unable to retrieve automation plan limits." },
      { status: 500 }
    );
  }
}
