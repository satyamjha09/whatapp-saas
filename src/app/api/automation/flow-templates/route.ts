import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { listAutomationFlowTemplateSummaries } from "@/server/services/automation-template-library.service";

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

    const templates = listAutomationFlowTemplateSummaries({
      search,
      category,
      difficulty,
      integration,
      tag,
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("AUTOMATION_TEMPLATES_LIST_ERROR:", error);
    return NextResponse.json(
      { message: "Unable to retrieve automation templates" },
      { status: 500 }
    );
  }
}
