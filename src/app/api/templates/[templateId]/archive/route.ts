import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { archiveTemplateForCompany } from "@/server/services/template.service";

type RouteContext = {
  params: Promise<{
    templateId: string;
  }>;
};

function canManageTemplates(role?: string) {
  return role === "OWNER" || role === "ADMIN";
}

export async function POST(_request: Request, { params }: RouteContext) {
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
    const template = await archiveTemplateForCompany({
      actorUserId: context.user.id,
      companyId: context.membership.companyId,
      templateId,
    });

    return NextResponse.json({
      message: "Template archived",
      template,
    });
  } catch (error) {
    console.error("ARCHIVE_TEMPLATE_ERROR:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to archive template",
      },
      { status: 400 },
    );
  }
}
