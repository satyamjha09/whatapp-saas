import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { createAutomationFlowFromTemplate } from "@/server/services/automation-template-library.service";
import { UseTemplateInputSchema } from "@/server/validators/automation-template-library.validator";
import {
  assertAutomationApiPermission,
  createAutomationPermissionErrorResponse,
} from "@/server/utils/automation-api-permission";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ templateSlug: string }> }
) {
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

    await assertAutomationApiPermission({
      companyId: context.membership.companyId,
      permission: "automation.template_library.use",
      userId: context.user.id,
    });

    const { templateSlug } = await params;
    const body = await request.json().catch(() => ({}));
    const result = UseTemplateInputSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: "Invalid request parameters", errors: result.error.flatten() },
        { status: 400 }
      );
    }

    const { flowId, redirectUrl, setupChecklist, missingRequirements } =
      await createAutomationFlowFromTemplate(
        context.membership.companyId,
        templateSlug,
        result.data,
        context.user.id
      );

    return NextResponse.json({
      flowId,
      redirectUrl,
      setupChecklist,
      missingRequirements,
    });
  } catch (error: unknown) {
    const permissionError = createAutomationPermissionErrorResponse(error);
    if (permissionError) return permissionError;

    console.error("AUTOMATION_TEMPLATES_USE_ERROR:", error);

    const err = error as Error;
    if (err.name === "TemplateNotFoundError") {
      return NextResponse.json({ message: err.message }, { status: 404 });
    }

    if (err.name === "TemplateMappingValidationError") {
      return NextResponse.json({ message: err.message }, { status: 400 });
    }

    if (err.name === "PlanFeatureAccessError") {
      return NextResponse.json(
        {
          code: (err as Error & { code?: string }).code,
          message: err.message,
          requiredPlan: (err as Error & { requiredPlan?: string }).requiredPlan,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { message: "Unable to instantiate automation flow template." },
      { status: 500 }
    );
  }
}
