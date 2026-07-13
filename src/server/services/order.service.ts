import { Prisma } from "@/generated/prisma/client";
import type {
  Order,
  OrderSource,
  OrderStatus,
  OrderStatusEventSource,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CancelOrderInput,
  CreateOrderInput,
  ListOrdersQuery,
  UpdateOrderInput,
  UpdateOrderStatusInput,
} from "@/server/validators/order.validator";

export class OrderServiceError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "ORDER_ERROR",
  ) {
    super(message);
  }
}

const ORDER_INCLUDE = {
  contact: {
    select: {
      id: true,
      name: true,
      countryCode: true,
      phoneNumber: true,
      email: true,
      city: true,
      companyName: true,
      customAttributes: true,
    },
  },
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      localProduct: {
        select: {
          id: true,
          name: true,
          retailerId: true,
          priceAmount: true,
          currency: true,
          imageUrl: true,
          isUsable: true,
        },
      },
    },
  },
  statusEvents: {
    orderBy: { createdAt: "asc" },
    include: {
      changedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.OrderInclude;

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "PACKED", "SHIPPED", "CANCELLED"],
  PROCESSING: ["PACKED", "SHIPPED", "CANCELLED"],
  PACKED: ["SHIPPED", "OUT_FOR_DELIVERY", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "REFUND_PENDING"],
  OUT_FOR_DELIVERY: ["DELIVERED", "REFUND_PENDING"],
  DELIVERED: ["REFUND_PENDING"],
  CANCELLED: [],
  REFUND_PENDING: ["REFUNDED"],
  REFUNDED: [],
};

function toDecimal(value: string | number | undefined, fallback = "0") {
  return new Prisma.Decimal(value ?? fallback);
}

function optionalText(value: string | undefined | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function decimalToString(value: Prisma.Decimal | null | undefined) {
  return value ? value.toFixed(2) : "0.00";
}

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof ORDER_INCLUDE;
}>;

export function serializeOrder(order: OrderWithRelations) {
  return {
    ...order,
    subtotalAmount: decimalToString(order.subtotalAmount),
    taxAmount: decimalToString(order.taxAmount),
    discountAmount: decimalToString(order.discountAmount),
    shippingAmount: decimalToString(order.shippingAmount),
    totalAmount: decimalToString(order.totalAmount),
    orderDate: order.orderDate.toISOString(),
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map((item) => ({
      ...item,
      unitPriceAmount: decimalToString(item.unitPriceAmount),
      taxAmount: decimalToString(item.taxAmount),
      discountAmount: decimalToString(item.discountAmount),
      lineTotalAmount: decimalToString(item.lineTotalAmount),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      localProduct: item.localProduct
        ? {
            ...item.localProduct,
            priceAmount: item.localProduct.priceAmount
              ? decimalToString(item.localProduct.priceAmount)
              : null,
          }
        : null,
    })),
    statusEvents: order.statusEvents.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

async function assertContactBelongsToCompany(companyId: string, contactId: string) {
  const contact = await prisma.contact.findFirst({
    where: { id: contactId, companyId },
    select: { id: true },
  });

  if (!contact) {
    throw new OrderServiceError(
      "Contact does not exist in this workspace",
      404,
      "CONTACT_NOT_FOUND",
    );
  }
}

async function getProductsById(companyId: string, localProductIds: string[]) {
  if (localProductIds.length === 0) return new Map();

  const products = await prisma.whatsAppCatalogProduct.findMany({
    where: {
      companyId,
      id: { in: localProductIds },
    },
    select: {
      id: true,
      name: true,
      retailerId: true,
      priceAmount: true,
      currency: true,
      isUsable: true,
    },
  });

  return new Map(products.map((product) => [product.id, product]));
}

function assertValidTransition(from: OrderStatus, to: OrderStatus) {
  if (from === to) {
    throw new OrderServiceError(
      `Order is already ${to}`,
      400,
      "ORDER_STATUS_UNCHANGED",
    );
  }

  if (!VALID_TRANSITIONS[from].includes(to)) {
    throw new OrderServiceError(
      `Cannot move order from ${from} to ${to}`,
      400,
      "INVALID_ORDER_STATUS_TRANSITION",
    );
  }
}

export async function createOrderForCompany(
  companyId: string,
  userId: string | null,
  input: CreateOrderInput,
) {
  await assertContactBelongsToCompany(companyId, input.contactId);

  const productIds = input.items
    .map((item) => optionalText(item.localProductId))
    .filter((value): value is string => Boolean(value));
  const productsById = await getProductsById(companyId, productIds);

  for (const productId of productIds) {
    if (!productsById.has(productId)) {
      throw new OrderServiceError(
        "Catalog product does not exist in this workspace",
        404,
        "PRODUCT_NOT_FOUND",
      );
    }
  }

  const preparedItems = input.items.map((item) => {
    const localProductId = optionalText(item.localProductId);
    const product = localProductId ? productsById.get(localProductId) : null;
    const quantity = item.quantity;
    const unitPrice = toDecimal(item.unitPrice);
    const tax = toDecimal(item.tax);
    const discount = toDecimal(item.discount);
    const lineTotal =
      item.lineTotal !== undefined
        ? toDecimal(item.lineTotal)
        : unitPrice.mul(quantity).plus(tax).minus(discount);

    if (lineTotal.isNegative()) {
      throw new OrderServiceError(
        "Order item line total cannot be negative",
        400,
        "INVALID_ORDER_ITEM_TOTAL",
      );
    }

    return {
      localProductId,
      retailerIdSnapshot: optionalText(item.retailerId) ?? product?.retailerId ?? null,
      productNameSnapshot: item.productName.trim() || product?.name || "Product",
      quantity,
      unitPriceAmount: unitPrice,
      taxAmount: tax,
      discountAmount: discount,
      lineTotalAmount: lineTotal,
    };
  });

  const subtotal = input.subtotal
    ? toDecimal(input.subtotal)
    : preparedItems.reduce(
        (total, item) => total.plus(item.unitPriceAmount.mul(item.quantity)),
        new Prisma.Decimal(0),
      );
  const itemTax = preparedItems.reduce(
    (total, item) => total.plus(item.taxAmount),
    new Prisma.Decimal(0),
  );
  const itemDiscount = preparedItems.reduce(
    (total, item) => total.plus(item.discountAmount),
    new Prisma.Decimal(0),
  );
  const tax = input.tax ? toDecimal(input.tax) : itemTax;
  const discount = input.discount ? toDecimal(input.discount) : itemDiscount;
  const shipping = toDecimal(input.shipping);
  const total = input.total
    ? toDecimal(input.total)
    : subtotal.plus(tax).plus(shipping).minus(discount);

  if (total.isNegative()) {
    throw new OrderServiceError(
      "Order total cannot be negative",
      400,
      "INVALID_ORDER_TOTAL",
    );
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          companyId,
          contactId: input.contactId,
          orderNumber: input.orderNumber.trim(),
          externalOrderId: optionalText(input.externalOrderId),
          source: input.source as OrderSource,
          currency: input.currency,
          subtotalAmount: subtotal,
          taxAmount: tax,
          discountAmount: discount,
          shippingAmount: shipping,
          totalAmount: total,
          currentStatus: input.status as OrderStatus,
          orderDate: input.orderDate ?? new Date(),
          items: {
            create: preparedItems.map((item) => ({
              ...item,
              companyId,
            })),
          },
        },
      });

      await tx.orderStatusEvent.create({
        data: {
          companyId,
          orderId: created.id,
          previousStatus: null,
          newStatus: input.status as OrderStatus,
          source: "DASHBOARD",
          changedByUserId: userId,
          note: "Order created",
        },
      });

      return tx.order.findUniqueOrThrow({
        where: { id: created.id },
        include: ORDER_INCLUDE,
      });
    });

    return order;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new OrderServiceError(
        "Order number already exists in this workspace",
        409,
        "DUPLICATE_ORDER_NUMBER",
      );
    }

    throw error;
  }
}

export async function listOrdersForCompany(
  companyId: string,
  query: ListOrdersQuery,
) {
  const where: Prisma.OrderWhereInput = { companyId };
  const AND: Prisma.OrderWhereInput[] = [];

  if (query.search) {
    const search = query.search.trim();
    AND.push({
      OR: [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { externalOrderId: { contains: search, mode: "insensitive" } },
        { contact: { name: { contains: search, mode: "insensitive" } } },
        { contact: { phoneNumber: { contains: search } } },
      ],
    });
  }

  if (query.status) where.currentStatus = query.status as OrderStatus;
  if (query.source) where.source = query.source as OrderSource;
  if (query.contactId) where.contactId = query.contactId;

  if (query.dateFrom || query.dateTo) {
    where.orderDate = {
      gte: query.dateFrom,
      lte: query.dateTo,
    };
  }

  if (AND.length > 0) where.AND = AND;

  const page = query.page;
  const pageSize = query.pageSize;
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        contact: ORDER_INCLUDE.contact,
        items: {
          select: { id: true },
        },
      },
      orderBy: { orderDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: orders.map((order) => ({
      id: order.id,
      contact: order.contact,
      currentStatus: order.currentStatus,
      currency: order.currency,
      externalOrderId: order.externalOrderId,
      itemCount: order.items.length,
      orderDate: order.orderDate.toISOString(),
      orderNumber: order.orderNumber,
      source: order.source,
      totalAmount: decimalToString(order.totalAmount),
      updatedAt: order.updatedAt.toISOString(),
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getOrderForCompany(companyId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, companyId },
    include: ORDER_INCLUDE,
  });

  if (!order) {
    throw new OrderServiceError("Order not found", 404, "ORDER_NOT_FOUND");
  }

  return order;
}

export async function updateOrderForCompany(
  companyId: string,
  orderId: string,
  input: UpdateOrderInput,
) {
  await getOrderForCompany(companyId, orderId);

  return prisma.order.update({
    where: { id: orderId },
    data: {
      externalOrderId: optionalText(input.externalOrderId),
      source: input.source as OrderSource | undefined,
      currency: input.currency,
      orderDate: input.orderDate,
    },
    include: ORDER_INCLUDE,
  });
}

export async function updateOrderStatusForCompany(
  companyId: string,
  userId: string | null,
  orderId: string,
  input: UpdateOrderStatusInput,
) {
  const existing = await getOrderForCompany(companyId, orderId);
  const nextStatus = input.status as OrderStatus;

  assertValidTransition(existing.currentStatus, nextStatus);

  return prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        currentStatus: nextStatus,
        cancelledAt: nextStatus === "CANCELLED" ? new Date() : undefined,
        cancelReason:
          nextStatus === "CANCELLED" ? optionalText(input.reason) : undefined,
      },
    });

    await tx.orderStatusEvent.create({
      data: {
        companyId,
        orderId,
        previousStatus: existing.currentStatus,
        newStatus: nextStatus,
        source: input.source as OrderStatusEventSource,
        changedByUserId: userId,
        reason: optionalText(input.reason),
        note: optionalText(input.note),
      },
    });

    return tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: ORDER_INCLUDE,
    });
  });
}

export async function cancelOrderForCompany(
  companyId: string,
  userId: string | null,
  orderId: string,
  input: CancelOrderInput,
) {
  return updateOrderStatusForCompany(companyId, userId, orderId, {
    status: "CANCELLED",
    source: "DASHBOARD",
    reason: input.reason,
    note: input.note,
  });
}

export function canMoveOrderTo(order: Pick<Order, "currentStatus">) {
  return VALID_TRANSITIONS[order.currentStatus];
}
