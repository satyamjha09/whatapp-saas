export const ORDER_STATUS_TEMPLATE_PURPOSES = [
  "ORDER_CONFIRMED",
  "ORDER_PROCESSING",
  "ORDER_PACKED",
  "ORDER_SHIPPED",
  "OUT_FOR_DELIVERY",
  "ORDER_DELIVERED",
  "ORDER_CANCELLED",
  "REFUND_INITIATED",
  "REFUND_COMPLETED",
] as const;

export type OrderStatusTemplatePurpose =
  (typeof ORDER_STATUS_TEMPLATE_PURPOSES)[number];

export const ORDER_STATUS_VARIABLE_SOURCES = [
  "CONTACT_FIELD",
  "ORDER_FIELD",
  "STATIC_VALUE",
  "SYSTEM_VALUE",
  "CUSTOM_FIELD",
] as const;

export type OrderStatusVariableSource =
  (typeof ORDER_STATUS_VARIABLE_SOURCES)[number];

export const ORDER_STATUS_CONTACT_FIELDS = [
  "name",
  "phoneNumber",
  "email",
  "companyName",
  "city",
] as const;

export const ORDER_STATUS_ORDER_FIELDS = [
  "orderNumber",
  "currentStatus",
  "totalAmount",
  "currency",
  "orderDate",
  "expectedDeliveryDate",
  "trackingNumber",
  "trackingUrl",
  "shippingProvider",
  "itemCount",
  "notes",
  "cancelReason",
] as const;

export const ORDER_STATUS_SYSTEM_FIELDS = [
  "today",
  "companyName",
  "supportPhone",
  "supportEmail",
] as const;

export type OrderStatusVariableMapping = {
  variable: string;
  source: OrderStatusVariableSource;
  field: string;
  sampleValue: string;
};

export type OrderStatusTemplateConfig = {
  purpose: OrderStatusTemplatePurpose;
  variableMappings: OrderStatusVariableMapping[];
};

export const ORDER_STATUS_PURPOSE_LABELS: Record<
  OrderStatusTemplatePurpose,
  string
> = {
  ORDER_CANCELLED: "Order Cancelled",
  ORDER_CONFIRMED: "Order Confirmed",
  ORDER_DELIVERED: "Order Delivered",
  ORDER_PACKED: "Order Packed",
  ORDER_PROCESSING: "Order Processing",
  ORDER_SHIPPED: "Order Shipped",
  OUT_FOR_DELIVERY: "Out for Delivery",
  REFUND_COMPLETED: "Refund Completed",
  REFUND_INITIATED: "Refund Initiated",
};

export const ORDER_STATUS_PURPOSE_DEFAULT_BODY: Record<
  OrderStatusTemplatePurpose,
  string
> = {
  ORDER_CANCELLED:
    "Hi {{1}},\n\nYour order {{2}} has been cancelled.\n\nReason: {{3}}\n\nIf you need help, contact our support team.",
  ORDER_CONFIRMED:
    "Hi {{1}},\n\nYour order {{2}} has been confirmed.\n\nOrder total: {{3}}\nExpected processing date: {{4}}",
  ORDER_DELIVERED:
    "Hi {{1}},\n\nYour order {{2}} has been delivered successfully.\n\nThank you for choosing us.",
  ORDER_PACKED:
    "Hi {{1}},\n\nYour order {{2}} has been packed and is getting ready for shipment.",
  ORDER_PROCESSING:
    "Hi {{1}},\n\nYour order {{2}} is now being processed.\n\nWe will update you once it is packed.",
  ORDER_SHIPPED:
    "Hi {{1}},\n\nYour order {{2}} has been shipped.\n\nTracking number: {{3}}\nExpected delivery: {{4}}\n\nThank you for shopping with us.",
  OUT_FOR_DELIVERY:
    "Hi {{1}},\n\nYour order {{2}} is out for delivery today.\n\nPlease keep your phone available.",
  REFUND_COMPLETED:
    "Hi {{1}},\n\nYour refund for order {{2}} has been completed.\n\nRefund reference: {{3}}",
  REFUND_INITIATED:
    "Hi {{1}},\n\nYour refund for order {{2}} has been initiated.\n\nExpected completion: {{3}}",
};

export const ORDER_STATUS_REQUIRED_FIELDS: Record<
  OrderStatusTemplatePurpose,
  string[]
> = {
  ORDER_CANCELLED: ["orderNumber", "cancelReason"],
  ORDER_CONFIRMED: ["orderNumber"],
  ORDER_DELIVERED: ["orderNumber"],
  ORDER_PACKED: ["orderNumber"],
  ORDER_PROCESSING: ["orderNumber"],
  ORDER_SHIPPED: ["orderNumber", "trackingNumber"],
  OUT_FOR_DELIVERY: ["orderNumber"],
  REFUND_COMPLETED: ["orderNumber"],
  REFUND_INITIATED: ["orderNumber"],
};

export function isAllowedOrderStatusTemplateField(
  source: string,
  field: string,
) {
  if (source === "CONTACT_FIELD") {
    return ORDER_STATUS_CONTACT_FIELDS.includes(
      field as (typeof ORDER_STATUS_CONTACT_FIELDS)[number],
    );
  }

  if (source === "ORDER_FIELD") {
    return ORDER_STATUS_ORDER_FIELDS.includes(
      field as (typeof ORDER_STATUS_ORDER_FIELDS)[number],
    );
  }

  if (source === "SYSTEM_VALUE") {
    return ORDER_STATUS_SYSTEM_FIELDS.includes(
      field as (typeof ORDER_STATUS_SYSTEM_FIELDS)[number],
    );
  }

  return source === "STATIC_VALUE" || source === "CUSTOM_FIELD";
}
