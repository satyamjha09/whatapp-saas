import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getAutomationTemplateDetails } from "@/server/services/automation-template.service";
import { automationTemplateParamsSchema } from "@/server/validators/automation-template.validator";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ templateId: string }> },
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
    const validation = automationTemplateParamsSchema.safeParse(resolvedParams);

    if (!validation.success) {
      return NextResponse.json(
        { message: "Invalid template ID" },
        { status: 400 },
      );
    }

    const template = await getAutomationTemplateDetails({
      companyId: context.membership.companyId,
      templateId: validation.data.templateId,
    });

    if (!template) {
      return NextResponse.json(
        { message: "Template not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      preview: template.preview,
      variableMetadata: template.variableMetadata,
    });
  } catch (error) {
    console.error("AUTOMATION_TEMPLATE_PREVIEW_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch template preview" },
      { status: 500 },
    );
  }
}
