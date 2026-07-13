import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  cancelOrderForCompany,
  OrderServiceError,
  serializeOrder,
} from "@/server/services/order.service";
import { cancelOrderSchema } from "@/server/validators/order.validator";

type OrderCancelRouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

function canManageOrders(role?: string) {
  return role === "OWNER" || role === "ADMIN";
}

export async function POST(
  request: Request,
  { params }: OrderCancelRouteContext,
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

    const body: unknown = await request.json().catch(() => ({}));
    const validation = cancelOrderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid cancel request",
        },
        { status: 400 },
      );
    }

    const { orderId } = await params;
    const order = await cancelOrderForCompany(
      context.membership.companyId,
      context.user.id,
      orderId,
      validation.data,
    );

    return NextResponse.json({
      message: "Order cancelled",
      order: serializeOrder(order),
    });
  } catch (error) {
    console.error("CANCEL_ORDER_ERROR:", error);

    if (error instanceof OrderServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to cancel order",
      },
      { status: 500 },
    );
  }
}
