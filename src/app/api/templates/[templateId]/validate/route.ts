import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { validateTemplateForMetaSubmission } from "@/server/services/whatsapp-template-validation.service";

type RouteContext = {
  params: Promise<{
    templateId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
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

    const { templateId } = await params;
    const template = await prisma.template.findFirst({
      where: {
        companyId: context.membership.companyId,
        id: templateId,
      },
    });

    if (!template) {
      return NextResponse.json({ message: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({
      validation: validateTemplateForMetaSubmission(template),
    });
  } catch (error) {
    console.error("VALIDATE_TEMPLATE_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to validate template" },
      { status: 500 },
    );
  }
}
