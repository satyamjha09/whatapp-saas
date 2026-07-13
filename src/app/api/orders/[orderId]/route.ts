import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  getOrderForCompany,
  OrderServiceError,
  serializeOrder,
  updateOrderForCompany,
} from "@/server/services/order.service";
import { updateOrderSchema } from "@/server/validators/order.validator";

type OrderRouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

function canManageOrders(role?: string) {
  return role === "OWNER" || role === "ADMIN";
}

export async function GET(_request: Request, { params }: OrderRouteContext) {
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

    const { orderId } = await params;
    const order = await getOrderForCompany(
      context.membership.companyId,
      orderId,
    );

    return NextResponse.json({ order: serializeOrder(order) });
  } catch (error) {
    console.error("GET_ORDER_ERROR:", error);

    if (error instanceof OrderServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { message: "Unable to fetch order" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: OrderRouteContext) {
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
    const validation = updateOrderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid order details",
        },
        { status: 400 },
      );
    }

    const { orderId } = await params;
    const order = await updateOrderForCompany(
      context.membership.companyId,
      orderId,
      validation.data,
    );

    return NextResponse.json({
      message: "Order updated",
      order: serializeOrder(order),
    });
  } catch (error) {
    console.error("UPDATE_ORDER_ERROR:", error);

    if (error instanceof OrderServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to update order",
      },
      { status: 500 },
    );
  }
}
