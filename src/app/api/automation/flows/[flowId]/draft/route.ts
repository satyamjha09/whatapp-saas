import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  AutomationFlowNotFoundError,
  saveAutomationFlowDraft,
} from "@/server/services/automation-versioning.service";
import { automationGraphShapeSchema } from "@/server/validators/automation-builder.validator";
import type { AutomationGraph } from "@/lib/automation-builder/types";

export async function PATCH(
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

    const { flowId } = await params;
    const body = await request.json().catch(() => ({}));
    const validation = automationGraphShapeSchema.safeParse(body.graph);

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid automation draft graph",
        },
        { status: 400 },
      );
    }

    const result = await saveAutomationFlowDraft(
      context.membership.companyId,
      flowId,
      validation.data as AutomationGraph,
      context.user.id,
    );

    return NextResponse.json({
      flow: {
        id: result.flow.id,
        publishedVersionId: result.flow.publishedVersionId,
        status: result.flow.status,
        updatedAt: result.flow.updatedAt,
      },
      hasUnpublishedChanges: result.hasUnpublishedChanges,
      validation: result.validation,
    });
  } catch (error) {
    if (error instanceof AutomationFlowNotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    console.error("AUTOMATION_DRAFT_SAVE_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to save automation draft" },
      { status: 500 },
    );
  }
}
