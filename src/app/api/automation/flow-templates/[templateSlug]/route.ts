import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { getAutomationFlowTemplate } from "@/lib/automation-templates/template-registry";

export async function GET(
  _request: Request,
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

    const { templateSlug } = await params;
    const template = getAutomationFlowTemplate(templateSlug);

    if (!template) {
      return NextResponse.json(
        { message: `Template with slug "${templateSlug}" not found.` },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error("AUTOMATION_TEMPLATES_DETAIL_ERROR:", error);
    return NextResponse.json(
      { message: "Unable to retrieve automation template details" },
      { status: 500 }
    );
  }
}
