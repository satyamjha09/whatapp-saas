import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { syncWhatsAppTemplatesFromMeta } from "@/server/services/whatsapp-template-sync.service";

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
    const existingTemplate = await prisma.template.findFirst({
      where: {
        companyId: context.membership.companyId,
        id: templateId,
      },
      select: {
        id: true,
      },
    });

    if (!existingTemplate) {
      return NextResponse.json({ message: "Template not found" }, { status: 404 });
    }

    const result = await syncWhatsAppTemplatesFromMeta(
      context.membership.companyId,
    );
    const template = await prisma.template.findFirst({
      where: {
        companyId: context.membership.companyId,
        id: templateId,
      },
    });

    return NextResponse.json({
      message: "Template status synced",
      sync: result,
      template,
    });
  } catch (error) {
    console.error("SYNC_TEMPLATE_ERROR:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to sync template",
      },
      { status: 400 },
    );
  }
}
