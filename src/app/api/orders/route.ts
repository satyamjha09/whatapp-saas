import { NextResponse } from "next/server";
import { getCurrentWorkspaceContext } from "@/server/auth/current-user";
import {
  createOrderForCompany,
  listOrdersForCompany,
  OrderServiceError,
  serializeOrder,
} from "@/server/services/order.service";
import {
  createOrderSchema,
  listOrdersQuerySchema,
} from "@/server/validators/order.validator";

const LIST_QUERY_PARAMS = [
  "search",
  "status",
  "source",
  "contactId",
  "dateFrom",
  "dateTo",
  "page",
  "pageSize",
] as const;

function canManageOrders(role?: string) {
  return role === "OWNER" || role === "ADMIN";
}

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const query = listOrdersQuerySchema.parse(
      Object.fromEntries(
        LIST_QUERY_PARAMS.map((param) => [
          param,
          url.searchParams.get(param) ?? undefined,
        ]).filter(([, value]) => value !== undefined),
      ),
    );

    const result = await listOrdersForCompany(
      context.membership.companyId,
      query,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("LIST_ORDERS_ERROR:", error);

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to fetch orders",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
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
    const validation = createOrderSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          errors: validation.error.flatten().fieldErrors,
          message: "Invalid order details",
        },
        { status: 400 },
      );
    }

    const order = await createOrderForCompany(
      context.membership.companyId,
      context.user.id,
      validation.data,
    );

    return NextResponse.json(
      {
        message: "Order created successfully",
        order: serializeOrder(order),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("CREATE_ORDER_ERROR:", error);

    if (error instanceof OrderServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Unable to create order",
      },
      { status: 500 },
    );
  }
}
