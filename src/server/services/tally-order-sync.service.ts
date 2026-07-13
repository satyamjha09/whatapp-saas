import { Prisma } from "@/generated/prisma/client";
import type { OrderStatus, OrderSyncStatus, TallyOrderSyncRunStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  resolveTallyCustomerMapping,
  resolveTallyProductMapping,
} from "@/server/services/tally-order-mapping.service";
import type {
  ListTallySyncRunsQuery,
  SyncTallyOrdersInput,
  TallySalesOrderInput,
} from "@/server/validators/tally-order-sync.validator";

export class TallyOrderSyncError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "TALLY_ORDER_SYNC_ERROR",
  ) {
    super(message);
  }
}

type TallyStatusMapping = {
  status: OrderStatus | null;
  warning?: string;
};

type SyncIssue = {
  externalOrderId: string;
  orderNumber?: string;
  code: string;
  message: string;
};

type SyncCounts = {
  ordersFound: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  unmappedCustomerCount: number;
  unmappedProductCount: number;
};

function optionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toDecimal(value: string | number | undefined, fallback = "0") {
  return new Prisma.Decimal(value ?? fallback);
}

function decimalToString(value: Prisma.Decimal | null | undefined) {
  return value ? value.toFixed(2) : "0.00";
}

export function mapTallyOrderStatus(
  rawStatus: string | null | undefined,
  currentStatus?: OrderStatus,
): TallyStatusMapping {
  const normalized = rawStatus?.trim().toLowerCase().replace(/[\s_-]+/g, " ") ?? "";

  if (!normalized || normalized === "optional" || normalized === "draft") {
    return { status: "DRAFT" };
  }

  if (
    normalized === "sales order" ||
    normalized === "confirmed" ||
    normalized === "accepted"
  ) {
    return { status: "CONFIRMED" };
  }

  if (normalized === "altered" || normalized === "processing") {
    return { status: "PROCESSING" };
  }

  if (
    normalized === "delivery note created" ||
    normalized === "delivery note" ||
    normalized === "shipped"
  ) {
    return { status: "SHIPPED" };
  }

  if (normalized === "cancelled" || normalized === "canceled") {
    return { status: "CANCELLED" };
  }

  return {
    status: currentStatus ?? "DRAFT",
    warning: `Unknown Tally status: ${rawStatus ?? "blank"}`,
  };
}

function calculateTotals(order: TallySalesOrderInput) {
  const itemSubtotal = order.items.reduce(
    (total, item) => total.plus(toDecimal(item.unitPrice).mul(item.quantity)),
    new Prisma.Decimal(0),
  );
  const itemTax = order.items.reduce(
    (total, item) => total.plus(toDecimal(item.tax)),
    new Prisma.Decimal(0),
  );
  const itemDiscount = order.items.reduce(
    (total, item) => total.plus(toDecimal(item.discount)),
    new Prisma.Decimal(0),
  );

  const subtotal = order.subtotal ? toDecimal(order.subtotal) : itemSubtotal;
  const tax = order.tax ? toDecimal(order.tax) : itemTax;
  const discount = order.discount ? toDecimal(order.discount) : itemDiscount;
  const shipping = toDecimal(order.shipping);
  const total = order.total
    ? toDecimal(order.total)
    : subtotal.plus(tax).plus(shipping).minus(discount);

  if (total.isNegative()) {
    throw new TallyOrderSyncError("Order total cannot be negative", 400, "INVALID_ORDER_TOTAL");
  }

  return { discount, shipping, subtotal, tax, total };
}

async function syncOneTallyOrder(
  companyId: string,
  tallyCompanyId: string,
  userId: string | null,
  input: TallySalesOrderInput,
) {
  const customerMapping = await resolveTallyCustomerMapping({
    companyId,
    customerEmail: input.customerEmail,
    customerGstin: input.customerGstin,
    customerPhone: input.customerPhone,
    tallyCompanyId,
    tallyLedgerId: input.ledgerId,
    tallyLedgerName: input.ledgerName,
  });

  if (!customerMapping.contact) {
    throw new TallyOrderSyncError(
      `Tally ledger "${input.ledgerName}" is not mapped to a contact`,
      422,
      "UNMAPPED_CUSTOMER",
    );
  }

  const productMappings = await Promise.all(
    input.items.map((item) =>
      resolveTallyProductMapping({
        companyId,
        retailerId: item.retailerId,
        sku: item.sku,
        tallyCompanyId,
        tallyStockItemId: item.tallyStockItemId,
        tallyStockItemName: item.tallyStockItemName,
      }),
    ),
  );

  const unmappedProductCount = productMappings.filter((mapping) => !mapping.product).length;
  const totals = calculateTotals(input);

  const existing = await prisma.order.findFirst({
    where: {
      companyId,
      externalOrderId: input.externalOrderId,
      source: "TALLY",
    },
    include: { items: true },
  });

  const statusMapping = mapTallyOrderStatus(input.status, existing?.currentStatus);
  const syncError = statusMapping.warning ?? (unmappedProductCount > 0 ? `${unmappedProductCount} item mapping(s) need review` : null);
  const syncStatus: OrderSyncStatus = syncError ? "NEEDS_REVIEW" : "SYNCED";
  const nextStatus = statusMapping.status ?? existing?.currentStatus ?? "DRAFT";
  const now = new Date();

  const preparedItems = input.items.map((item, index) => {
    const product = productMappings[index]?.product ?? null;
    const unitPrice = toDecimal(item.unitPrice);
    const tax = toDecimal(item.tax);
    const discount = toDecimal(item.discount);
    const lineTotal = item.lineTotal
      ? toDecimal(item.lineTotal)
      : unitPrice.mul(item.quantity).plus(tax).minus(discount);

    return {
      companyId,
      localProductId: product?.id ?? null,
      retailerIdSnapshot: optionalText(item.retailerId) ?? optionalText(item.sku) ?? product?.retailerId ?? null,
      productNameSnapshot: item.tallyStockItemName,
      quantity: item.quantity,
      unitPriceAmount: unitPrice,
      taxAmount: tax,
      discountAmount: discount,
      lineTotalAmount: lineTotal,
      metadata: {
        matchSource: productMappings[index]?.matchSource ?? "MANUAL_REVIEW",
        tallyStockItemId: item.tallyStockItemId,
      } satisfies Prisma.InputJsonValue,
    };
  });

  const orderData = {
    contactId: customerMapping.contact.id,
    orderNumber: input.orderNumber,
    externalOrderId: input.externalOrderId,
    externalCompanyId: tallyCompanyId,
    source: "TALLY" as const,
    currency: input.currency,
    subtotalAmount: totals.subtotal,
    taxAmount: totals.tax,
    discountAmount: totals.discount,
    shippingAmount: totals.shipping,
    totalAmount: totals.total,
    currentStatus: nextStatus,
    orderDate: input.orderDate ?? now,
    notes: optionalText(input.narration),
    syncStatus,
    syncError,
    lastSyncedAt: now,
    metadata: {
      conflictPolicy: {
        localOwned: ["whatsAppSendState", "notes", "assignedAgent", "automation"],
        statusAuthority: "TALLY_WHEN_STATUS_IS_KNOWN",
        tallyOwned: ["orderNumber", "orderDate", "items", "amounts", "externalStatus"],
      },
      customerMatchSource: customerMapping.matchSource,
      rawTallyStatus: input.status,
    } satisfies Prisma.InputJsonValue,
  };

  const savedOrder = await prisma.$transaction(async (tx) => {
    if (existing) {
      await tx.order.update({
        where: { id: existing.id },
        data: orderData,
      });

      await tx.orderItem.deleteMany({ where: { orderId: existing.id } });
      await tx.orderItem.createMany({
        data: preparedItems.map((item) => ({ ...item, orderId: existing.id })),
      });

      if (!statusMapping.warning && existing.currentStatus !== nextStatus) {
        await tx.orderStatusEvent.create({
          data: {
            companyId,
            orderId: existing.id,
            previousStatus: existing.currentStatus,
            newStatus: nextStatus,
            source: "TALLY",
            changedByUserId: userId,
            note: `Tally status synced from ${input.status}`,
          },
        });
      }

      return tx.order.findUniqueOrThrow({ where: { id: existing.id } });
    }

    const created = await tx.order.create({
      data: {
        companyId,
        ...orderData,
        items: {
          create: preparedItems,
        },
      },
    });

    await tx.orderStatusEvent.create({
      data: {
        companyId,
        orderId: created.id,
        previousStatus: null,
        newStatus: nextStatus,
        source: "TALLY",
        changedByUserId: userId,
        note: statusMapping.warning
          ? "Tally order imported with status review needed"
          : `Tally order imported as ${nextStatus}`,
      },
    });

    return created;
  });

  return {
    id: savedOrder.id,
    orderNumber: savedOrder.orderNumber,
    totalAmount: decimalToString(savedOrder.totalAmount),
    unmappedProductCount,
    wasCreated: !existing,
  };
}

export async function syncTallyOrdersForCompany(
  companyId: string,
  userId: string | null,
  input: SyncTallyOrdersInput,
) {
  const run = await prisma.tallyOrderSyncRun.create({
    data: {
      companyId,
      tallyCompanyId: input.tallyCompanyId,
      ordersFound: input.orders.length,
      status: "RUNNING",
    },
  });

  const counts: SyncCounts = {
    ordersFound: input.orders.length,
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    unmappedCustomerCount: 0,
    unmappedProductCount: 0,
  };
  const issues: SyncIssue[] = [];

  for (const order of input.orders) {
    try {
      const result = await syncOneTallyOrder(
        companyId,
        input.tallyCompanyId,
        userId,
        order,
      );

      if (result.wasCreated) counts.createdCount += 1;
      else counts.updatedCount += 1;
      counts.unmappedProductCount += result.unmappedProductCount;
    } catch (error) {
      counts.failedCount += 1;
      if (error instanceof TallyOrderSyncError && error.code === "UNMAPPED_CUSTOMER") {
        counts.unmappedCustomerCount += 1;
      }
      issues.push({
        code: error instanceof TallyOrderSyncError ? error.code : "ORDER_SYNC_FAILED",
        externalOrderId: order.externalOrderId,
        message: error instanceof Error ? error.message : "Order sync failed",
        orderNumber: order.orderNumber,
      });
    }
  }

  const status: TallyOrderSyncRunStatus =
    counts.failedCount === 0
      ? "COMPLETED"
      : counts.createdCount + counts.updatedCount > 0
        ? "PARTIAL_FAILED"
        : "FAILED";

  const updatedRun = await prisma.tallyOrderSyncRun.update({
    where: { id: run.id },
    data: {
      ...counts,
      completedAt: new Date(),
      errorCode: counts.failedCount > 0 ? "ORDER_SYNC_ISSUES" : null,
      errorMessage: counts.failedCount > 0 ? `${counts.failedCount} order(s) failed to sync` : null,
      status,
      summary: { issues } satisfies Prisma.InputJsonValue,
    },
  });

  return { issues, run: updatedRun };
}

export async function listTallyOrderSyncRunsForCompany(
  companyId: string,
  query: ListTallySyncRunsQuery,
) {
  const where: Prisma.TallyOrderSyncRunWhereInput = {
    companyId,
    ...(query.tallyCompanyId ? { tallyCompanyId: query.tallyCompanyId } : {}),
  };
  const page = query.page;
  const pageSize = query.pageSize;
  const [runs, total] = await Promise.all([
    prisma.tallyOrderSyncRun.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.tallyOrderSyncRun.count({ where }),
  ]);

  return {
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    runs,
  };
}

