import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { sendTestWhatsAppFlow } from "@/server/services/whatsapp-flow.service";
import { sendTestWhatsAppFlowSchema } from "@/server/validators/whatsapp-flow.validator";

type SendTestWhatsAppFlowRouteContext = {
  params: Promise<{
    flowId: string;
  }>;
};

export async function POST(
  request: Request,
  { params }: SendTestWhatsAppFlowRouteContext,
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
        { message: "You do not have permission to send test flows" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    const validation = sendTestWhatsAppFlowSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid test recipient",
        },
        { status: 400 },
      );
    }

    const { flowId } = await params;
    const result = await sendTestWhatsAppFlow({
      companyId: context.membership.companyId,
      flowId,
      input: validation.data,
    });

    return NextResponse.json({
      contact: result.contact,
      message: "Test Flow queued",
      queuedMessage: result.message,
    });
  } catch (error) {
    console.error("SEND_TEST_WHATSAPP_FLOW_ERROR:", error);

    if (
      error instanceof Error &&
      ["Flow not found or not published", "Insufficient wallet balance"].includes(
        error.message,
      )
    ) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to send test WhatsApp Flow",
      },
      { status: 500 },
    );
  }
}
