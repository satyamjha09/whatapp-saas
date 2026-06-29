import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  getWhatsAppFlowById,
  updateWhatsAppFlow,
} from "@/server/services/whatsapp-flow.service";
import { updateWhatsAppFlowSchema } from "@/server/validators/whatsapp-flow.validator";

type WhatsAppFlowRouteContext = {
  params: Promise<{
    flowId: string;
  }>;
};

export async function GET(_request: Request, { params }: WhatsAppFlowRouteContext) {
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

    const { flowId } = await params;
    const flow = await getWhatsAppFlowById({
      companyId: context.membership.companyId,
      flowId,
    });

    if (!flow) {
      return NextResponse.json({ message: "Flow not found" }, { status: 404 });
    }

    return NextResponse.json({ flow });
  } catch (error) {
    console.error("GET_WHATSAPP_FLOW_ERROR:", error);

    return NextResponse.json(
      { message: "Unable to fetch WhatsApp flow" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: WhatsAppFlowRouteContext,
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

    if (
      context.membership.role !== "OWNER" &&
      context.membership.role !== "ADMIN"
    ) {
      return NextResponse.json(
        { message: "You do not have permission to manage WhatsApp flows" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    const validation = updateWhatsAppFlowSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid WhatsApp flow details",
        },
        { status: 400 },
      );
    }

    const { flowId } = await params;
    const flow = await updateWhatsAppFlow({
      companyId: context.membership.companyId,
      flowId,
      input: validation.data,
    });

    return NextResponse.json({
      flow,
      message: "WhatsApp flow updated",
    });
  } catch (error) {
    console.error("UPDATE_WHATSAPP_FLOW_ERROR:", error);

    if (error instanceof Error && error.message === "Flow not found") {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to update WhatsApp flow",
      },
      { status: 400 },
    );
  }
}
