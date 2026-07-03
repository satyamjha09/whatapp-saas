import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { submitWhatsAppTemplateForApproval } from "@/server/services/whatsapp-template-submit.service";
import { NUMERIC_WABA_ID_MESSAGE } from "@/server/whatsapp/meta-ids";

type RouteContext = {
  params: Promise<{
    templateId: string;
  }>;
};

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

    if (
      context.membership.role !== "OWNER" &&
      context.membership.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { message: "You do not have permission to submit templates" },
        { status: 403 },
      );
    }

    const { templateId } = await params;
    const template = await submitWhatsAppTemplateForApproval({
      actorUserId: context.user.id,
      companyId: context.membership.companyId,
      templateId,
    });

    return NextResponse.json({
      message: "Template submitted to Meta",
      template,
    });
  } catch (error) {
    console.error("SUBMIT_TEMPLATE_TO_META_ERROR:", error);

    if (
      error instanceof Error &&
      ([
        "Template not found",
        "Only draft or rejected templates can be submitted",
        "WhatsApp account is not connected",
        "Template is not ready for Meta submission",
        NUMERIC_WABA_ID_MESSAGE,
      ].includes(error.message) ||
        error.message.startsWith("Meta rejected WABA ID") ||
        error.message.startsWith("Template ") ||
        error.message.includes("Meta submission"))
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to submit template to Meta",
      },
      { status: 500 },
    );
  }
}
