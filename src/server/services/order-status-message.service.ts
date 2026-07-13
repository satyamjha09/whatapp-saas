import type { OrderStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ORDER_STATUS_REQUIRED_FIELDS,
  type OrderStatusTemplateConfig,
  type OrderStatusTemplatePurpose,
  type OrderStatusVariableMapping,
} from "@/lib/whatsapp-template/order-status-template";
import { canonicalizeTemplateDraft } from "@/lib/whatsapp-template/template-definition";
import { createQueuedTemplateMessage } from "@/server/services/message.service";
import {
  getOrderForCompany,
  OrderServiceError,
} from "@/server/services/order.service";
import type { SendOrderStatusUpdateInput } from "@/server/validators/order-status-message.validator";

const PURPOSE_BY_ORDER_STATUS: Record<OrderStatus, OrderStatusTemplatePurpose> =
  {
    CANCELLED: "ORDER_CANCELLED",
    CONFIRMED: "ORDER_CONFIRMED",
    DELIVERED: "ORDER_DELIVERED",
    DRAFT: "ORDER_CONFIRMED",
    OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
    PACKED: "ORDER_PACKED",
    PROCESSING: "ORDER_PROCESSING",
    REFUND_PENDING: "REFUND_INITIATED",
    REFUNDED: "REFUND_COMPLETED",
    SHIPPED: "ORDER_SHIPPED",
  };

type OrderRecord = Awaited<ReturnType<typeof getOrderForCompany>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeVariableKey(value: string) {
  return value
    .trim()
    .replace(/^(BODY|HEADER|BUTTON)_/i, "")
    .replace(/^{{\s*/, "")
    .replace(/\s*}}$/, "");
}

function readOrderStatusConfig(
  components: unknown,
): OrderStatusTemplateConfig | null {
  if (!isRecord(components) || !isRecord(components.orderStatus)) return null;

  const orderStatus = components.orderStatus;
  const purpose = cleanText(orderStatus.purpose).toUpperCase();
  const rawMappings = Array.isArray(orderStatus.variableMappings)
    ? orderStatus.variableMappings
    : [];

  if (!purpose) return null;

  return {
    purpose: purpose as OrderStatusTemplatePurpose,
    variableMappings: rawMappings.filter(isRecord).map((mapping) => ({
      field: cleanText(mapping.field),
      sampleValue: cleanText(mapping.sampleValue),
      source: cleanText(mapping.source).toUpperCase() as OrderStatusVariableMapping["source"],
      variable: cleanText(mapping.variable),
    })),
  };
}

function formatStatus(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(date);
}

function formatCurrency(amount: { toString(): string }, currency: string) {
  const numeric = Number(amount.toString());
  if (!Number.isFinite(numeric)) return `${currency} ${amount.toString()}`;

  return new Intl.NumberFormat("en-IN", {
    currency,
    maximumFractionDigits: 2,
    style: "currency",
  }).format(numeric);
}

function readJsonText(source: unknown, keys: string[]) {
  if (!isRecord(source)) return "";

  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function orderFieldValue(order: OrderRecord, field: string) {
  const metadata = order.metadata;

  switch (field) {
    case "cancelReason":
      return order.cancelReason ?? "";
    case "currency":
      return order.currency;
    case "currentStatus":
      return formatStatus(order.currentStatus);
    case "expectedDeliveryDate":
      return readJsonText(metadata, [
        "expectedDeliveryDate",
        "expected_delivery_date",
        "deliveryDate",
        "delivery_date",
        "estimatedDeliveryDate",
      ]);
    case "itemCount":
      return String(order.items.reduce((total, item) => total + item.quantity, 0));
    case "notes":
      return order.notes ?? "";
    case "orderDate":
      return formatDate(order.orderDate);
    case "orderNumber":
      return order.orderNumber;
    case "shippingProvider":
      return readJsonText(metadata, [
        "shippingProvider",
        "shipping_provider",
        "carrier",
        "courier",
      ]);
    case "totalAmount":
      return formatCurrency(order.totalAmount, order.currency);
    case "trackingNumber":
      return readJsonText(metadata, [
        "trackingNumber",
        "tracking_number",
        "trackingNo",
        "awb",
        "awbNumber",
      ]);
    case "trackingUrl":
      return readJsonText(metadata, [
        "trackingUrl",
        "tracking_url",
        "shipmentUrl",
        "shipment_url",
      ]);
    default:
      return "";
  }
}

function contactFieldValue(order: OrderRecord, field: string) {
  switch (field) {
    case "city":
      return order.contact.city ?? "";
    case "companyName":
      return order.contact.companyName ?? "";
    case "email":
      return order.contact.email ?? "";
    case "name":
      return order.contact.name ?? "";
    case "phoneNumber":
      return `+${order.contact.countryCode}${order.contact.phoneNumber}`;
    default:
      return "";
  }
}

function systemFieldValue(
  company: { name: string; supportEmail: string | null; supportPhone: string | null },
  field: string,
) {
  switch (field) {
    case "companyName":
      return company.name;
    case "supportEmail":
      return company.supportEmail ?? "";
    case "supportPhone":
      return company.supportPhone ?? "";
    case "today":
      return formatDate(new Date());
    default:
      return "";
  }
}

function customFieldValue(order: OrderRecord, field: string) {
  return (
    readJsonText(order.contact.customAttributes, [field]) ||
    readJsonText(order.metadata, [field])
  );
}

function resolveMappingValue({
  company,
  mapping,
  order,
}: {
  company: { name: string; supportEmail: string | null; supportPhone: string | null };
  mapping: OrderStatusVariableMapping;
  order: OrderRecord;
}) {
  if (mapping.source === "CONTACT_FIELD") {
    return contactFieldValue(order, mapping.field);
  }

  if (mapping.source === "ORDER_FIELD") {
    return orderFieldValue(order, mapping.field);
  }

  if (mapping.source === "SYSTEM_VALUE") {
    return systemFieldValue(company, mapping.field);
  }

  if (mapping.source === "CUSTOM_FIELD") {
    return customFieldValue(order, mapping.field);
  }

  if (mapping.source === "STATIC_VALUE") {
    return mapping.field || mapping.sampleValue;
  }

  return "";
}

function assertRequiredOrderFields(order: OrderRecord, config: OrderStatusTemplateConfig) {
  const requiredFields = ORDER_STATUS_REQUIRED_FIELDS[config.purpose] ?? [];

  for (const field of requiredFields) {
    if (!orderFieldValue(order, field).trim()) {
      throw new OrderServiceError(
        `Order is missing required ${formatStatus(field)} value for this template`,
        400,
        "ORDER_STATUS_FIELD_MISSING",
      );
    }
  }
}

function resolveTemplateVariables({
  company,
  config,
  order,
  templateVariables,
}: {
  company: { name: string; supportEmail: string | null; supportPhone: string | null };
  config: OrderStatusTemplateConfig;
  order: OrderRecord;
  templateVariables: string[];
}) {
  const mappingsByVariable = new Map(
    config.variableMappings.map((mapping) => [
      normalizeVariableKey(mapping.variable),
      mapping,
    ]),
  );

  return templateVariables.map((templateVariable) => {
    const normalizedVariable = normalizeVariableKey(templateVariable);
    const mapping = mappingsByVariable.get(normalizedVariable);

    if (!mapping) {
      throw new OrderServiceError(
        `No runtime mapping found for template variable ${templateVariable}`,
        400,
        "ORDER_STATUS_MAPPING_MISSING",
      );
    }

    const value = resolveMappingValue({ company, mapping, order }).trim();

    if (!value) {
      throw new OrderServiceError(
        `Template variable ${templateVariable} resolved to an empty value`,
        400,
        "ORDER_STATUS_VALUE_MISSING",
      );
    }

    return value;
  });
}

export async function sendOrderStatusWhatsAppUpdate(
  companyId: string,
  orderId: string,
  input: SendOrderStatusUpdateInput,
) {
  const order = await getOrderForCompany(companyId, orderId);
  const template = await prisma.template.findFirst({
    where: {
      companyId,
      id: input.templateId,
      status: "APPROVED",
    },
  });

  if (!template) {
    throw new OrderServiceError(
      "Approved order status template not found",
      404,
      "ORDER_STATUS_TEMPLATE_NOT_FOUND",
    );
  }

  const canonicalTemplate = canonicalizeTemplateDraft(template);

  if (
    canonicalTemplate.templateType !== "ORDER_STATUS" ||
    canonicalTemplate.templateCategory !== "UTILITY"
  ) {
    throw new OrderServiceError(
      "Selected template is not an approved Utility order status template",
      400,
      "ORDER_STATUS_TEMPLATE_INVALID",
    );
  }

  const config = readOrderStatusConfig(template.components);

  if (!config) {
    throw new OrderServiceError(
      "Order status template runtime configuration is missing",
      400,
      "ORDER_STATUS_CONFIG_MISSING",
    );
  }

  const expectedPurpose = PURPOSE_BY_ORDER_STATUS[order.currentStatus];

  if (config.purpose !== expectedPurpose) {
    throw new OrderServiceError(
      `This template is for ${formatStatus(
        config.purpose,
      )}, but the order is ${formatStatus(order.currentStatus)}`,
      400,
      "ORDER_STATUS_PURPOSE_MISMATCH",
    );
  }

  assertRequiredOrderFields(order, config);

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      name: true,
      supportEmail: true,
      supportPhone: true,
    },
  });

  if (!company) {
    throw new OrderServiceError("Company not found", 404, "COMPANY_NOT_FOUND");
  }

  const variables = resolveTemplateVariables({
    company,
    config,
    order,
    templateVariables: template.variables,
  });
  const latestStatusEvent = order.statusEvents.at(-1);
  const idempotencyKey =
    input.idempotencyKey ??
    `order-status:${order.id}:${template.id}:${
      latestStatusEvent?.id ?? order.updatedAt.getTime()
    }`;

  const existingMessage = await prisma.message.findUnique({
    where: {
      companyId_idempotencyKey: {
        companyId,
        idempotencyKey,
      },
    },
    include: {
      contact: true,
      events: true,
      template: true,
    },
  });

  if (existingMessage) {
    return existingMessage;
  }

  return createQueuedTemplateMessage(companyId, {
    contactId: order.contactId,
    idempotencyKey,
    orderStatusContext: {
      currentStatus: order.currentStatus,
      orderId: order.id,
      orderNumber: order.orderNumber,
      purpose: config.purpose,
    },
    templateId: template.id,
    variables,
  });
}
