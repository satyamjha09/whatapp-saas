import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  checkCanCreateAutomationFlow,
  checkCanPublishAutomationFlow,
  checkCanRunAutomationExecution,
  checkCanRunLiveTest,
  checkCanUseTemplateLibrary,
} from "@/server/services/automation-plan-limit.service";
import { getAutomationFlowTemplateBySlug } from "@/server/services/automation-template-library.service";
import { PlanFeatureAccessError } from "@/server/services/plan-feature.service";
import { automationGraphShapeSchema } from "@/server/validators/automation-builder.validator";
import { UsageCheckInputSchema } from "@/server/validators/automation-plan-limit.validator";
import type { AutomationGraph } from "@/lib/automation-builder/types";

export async function POST(request: Request) {
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

    const body = await request.json().catch(() => ({}));
    const parsed = UsageCheckInputSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid check parameters", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const companyId = context.membership.companyId;
    const { action, flowId, graph, nodeTypes, templateSlug } = parsed.data;

    switch (action) {
      case "CREATE_FLOW":
        await checkCanCreateAutomationFlow(companyId);
        break;

      case "RUN_TEST":
        await checkCanRunLiveTest(companyId);
        break;

      case "PUBLISH_FLOW": {
        if (!flowId) {
          return NextResponse.json(
            { message: "flowId is required for PUBLISH_FLOW checks." },
            { status: 400 }
          );
        }

        const graphValidation = automationGraphShapeSchema.safeParse(graph);
        if (!graphValidation.success) {
          return NextResponse.json(
            { message: "A valid graph is required for PUBLISH_FLOW checks.", errors: graphValidation.error.flatten() },
            { status: 400 }
          );
        }

        await checkCanPublishAutomationFlow(
          companyId,
          flowId,
          graphValidation.data as AutomationGraph
        );
        break;
      }

      case "RUN_EXECUTION":
        if (!flowId) {
          return NextResponse.json(
            { message: "flowId is required for RUN_EXECUTION checks." },
            { status: 400 }
          );
        }
        await checkCanRunAutomationExecution(companyId, flowId);
        break;

      case "USE_TEMPLATE":
        if (templateSlug) {
          const template = getAutomationFlowTemplateBySlug(templateSlug);
          if (!template) {
            return NextResponse.json(
              { message: "Automation template was not found." },
              { status: 404 }
            );
          }

          const templateNodeTypes = Array.from(
            new Set(template.graph.nodes.map((node) => node.type))
          );
          await checkCanUseTemplateLibrary(companyId, templateNodeTypes);
        } else if (nodeTypes && nodeTypes.length > 0) {
          await checkCanUseTemplateLibrary(companyId, nodeTypes);
        }
        break;

      default:
        break;
    }

    return NextResponse.json({ allowed: true });
  } catch (error: unknown) {
    if (error instanceof PlanFeatureAccessError) {
      return NextResponse.json({
        allowed: false,
        reason: error.message,
        code: error.code,
        requiredPlan: error.requiredPlan,
      });
    }

    console.error("CHECK_USAGE_LIMIT_ERROR:", error);
    return NextResponse.json(
      { message: "Unable to check plan limits." },
      { status: 500 }
    );
  }
}
