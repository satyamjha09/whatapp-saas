import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { deleteDraftTemplateForCompany } from "@/server/services/template.service";

type RouteContext = {
  params: Promise<{
    templateId: string;
  }>;
};

function canManageTemplates(role?: string) {
  return role === "OWNER" || role === "ADMIN";
}

export async function DELETE(_request: Request, { params }: RouteContext) {
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

    if (!canManageTemplates(context.membership.role)) {
      return NextResponse.json(
        { message: "You do not have permission to manage templates" },
        { status: 403 },
      );
    }

    const { templateId } = await params;
    await deleteDraftTemplateForCompany({
      companyId: context.membership.companyId,
      templateId,
    });

    return NextResponse.json({
      message: "Template deleted",
    });
  } catch (error) {
    console.error("DELETE_TEMPLATE_ERROR:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to delete template",
      },
      { status: 400 },
    );
  }
}
