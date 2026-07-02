import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { listAutomationFlowTemplates } from "@/lib/automation-templates/template-registry";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const category = searchParams.get("category") || undefined;
    const difficulty = searchParams.get("difficulty") || undefined;
    const integration = searchParams.get("integration") || undefined;
    const tag = searchParams.get("tag") || undefined;

    const templates = listAutomationFlowTemplates({
      search,
      category,
      difficulty,
      integration,
      tag,
    });

    // Map list to template summaries
    const summaries = templates.map((t) => ({
      slug: t.slug,
      name: t.name,
      description: t.description,
      category: t.category,
      difficulty: t.difficulty,
      estimatedSetupMinutes: t.estimatedSetupMinutes,
      tags: t.tags,
      requiredIntegrations: t.requiredIntegrations,
      nodesCount: t.graph.nodes.length,
      previewNodeTypes: Array.from(new Set(t.graph.nodes.map((n) => n.type))),
    }));

    return NextResponse.json({ templates: summaries });
  } catch (error) {
    console.error("AUTOMATION_TEMPLATES_LIST_ERROR:", error);
    return NextResponse.json(
      { message: "Unable to retrieve automation templates" },
      { status: 500 }
    );
  }
}
