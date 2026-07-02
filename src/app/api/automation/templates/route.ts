import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { listAutomationTemplates } from "@/server/services/automation-template.service";
import { automationTemplateQuerySchema } from "@/server/validators/automation-template.validator";

export async function GET(request: Request) {
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
    const validation = automationTemplateQuerySchema.safeParse({
      category: url.searchParams.get("category") || undefined,
      languageCode: url.searchParams.get("languageCode") || undefined,
      limit: url.searchParams.get("limit") || undefined,
      search: url.searchParams.get("search") || undefined,
      status: url.searchParams.get("status") || undefined,
    });

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid template filters",
        },
        { status: 400 },
      );
    }

    const templates = await listAutomationTemplates({
      ...validation.data,
      companyId: context.membership.companyId,
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error("AUTOMATION_TEMPLATES_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch automation templates" },
      { status: 500 },
    );
  }
}
