import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import { OrderServiceError } from "@/server/services/order.service";
import { sendOrderStatusWhatsAppUpdate } from "@/server/services/order-status-message.service";
import { sendOrderStatusUpdateSchema } from "@/server/validators/order-status-message.validator";

type SendWhatsAppUpdateRouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

function canManageOrders(role?: string) {
  return role === "OWNER" || role === "ADMIN";
}

export async function POST(
  request: Request,
  { params }: SendWhatsAppUpdateRouteContext,
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

    if (!canManageOrders(context.membership.role)) {
      return NextResponse.json(
        { message: "You do not have permission to manage orders" },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    const validation = sendOrderStatusUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid WhatsApp order update request",
        },
        { status: 400 },
      );
    }

    const { orderId } = await params;
    const message = await sendOrderStatusWhatsAppUpdate(
      context.membership.companyId,
      orderId,
      validation.data,
    );

    return NextResponse.json({
      message: "WhatsApp order update queued",
      queuedMessage: {
        id: message.id,
        status: message.status,
        templateId: message.templateId,
        toPhoneNumber: message.toPhoneNumber,
      },
    });
  } catch (error) {
    console.error("SEND_ORDER_STATUS_WHATSAPP_UPDATE_ERROR:", error);

    if (error instanceof OrderServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Unable to send WhatsApp order update",
      },
      { status: 500 },
    );
  }
}
