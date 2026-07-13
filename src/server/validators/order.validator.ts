import { z } from "zod";

export const ORDER_STATUSES = [
  "DRAFT",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "REFUND_PENDING",
  "REFUNDED",
] as const;

export const ORDER_SOURCES = [
  "MANUAL",
  "TALLY",
  "API",
  "CATALOG",
  "WHATSAPP",
  "IMPORT",
] as const;

export const ORDER_STATUS_EVENT_SOURCES = [
  "DASHBOARD",
  "TALLY",
  "API",
  "AUTOMATION",
  "SYSTEM",
  "WEBHOOK",
] as const;

const decimalStringSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim())
  .refine((value) => value.length > 0, "Amount is required")
  .refine(
    (value) => /^-?\d+(\.\d{1,6})?$/.test(value),
    "Amount must be a valid number with up to 6 decimals",
  );

const nonNegativeAmountSchema = decimalStringSchema.refine(
  (value) => Number(value) >= 0,
  "Amount cannot be negative",
);

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

export const orderItemInputSchema = z.object({
  localProductId: z.string().trim().min(1).optional().or(z.literal("")),
  retailerId: z.string().trim().max(191).optional().or(z.literal("")),
  productName: z
    .string()
    .trim()
    .min(1, "Product name is required")
    .max(180, "Product name must be less than 180 characters"),
  quantity: z.coerce
    .number()
    .int()
    .min(1, "Quantity must be at least 1")
    .max(999_999, "Quantity is too large"),
  unitPrice: nonNegativeAmountSchema,
  tax: nonNegativeAmountSchema.optional(),
  discount: nonNegativeAmountSchema.optional(),
  lineTotal: nonNegativeAmountSchema.optional(),
});

export const createOrderSchema = z.object({
  contactId: z.string().trim().min(1, "Contact is required"),
  orderNumber: z
    .string()
    .trim()
    .min(1, "Order number is required")
    .max(80, "Order number must be less than 80 characters"),
  externalOrderId: z.string().trim().max(120).optional().or(z.literal("")),
  source: z.enum(ORDER_SOURCES).default("MANUAL"),
  currency: z
    .string()
    .trim()
    .min(3, "Currency is required")
    .max(3, "Currency must be a 3-letter code")
    .transform((value) => value.toUpperCase())
    .default("INR"),
  subtotal: nonNegativeAmountSchema.optional(),
  tax: nonNegativeAmountSchema.optional(),
  discount: nonNegativeAmountSchema.optional(),
  shipping: nonNegativeAmountSchema.optional(),
  total: nonNegativeAmountSchema.optional(),
  status: z.enum(ORDER_STATUSES).default("DRAFT"),
  orderDate: z.coerce.date().optional(),
  items: z
    .array(orderItemInputSchema)
    .min(1, "At least one order item is required")
    .max(200, "An order cannot contain more than 200 items"),
});

export const listOrdersQuerySchema = z.object({
  search: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  status: z.preprocess(emptyToUndefined, z.enum(ORDER_STATUSES).optional()),
  source: z.preprocess(emptyToUndefined, z.enum(ORDER_SOURCES).optional()),
  contactId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  dateFrom: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  dateTo: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateOrderSchema = z.object({
  externalOrderId: z.string().trim().max(120).optional().or(z.literal("")),
  source: z.enum(ORDER_SOURCES).optional(),
  currency: z
    .string()
    .trim()
    .min(3)
    .max(3)
    .transform((value) => value.toUpperCase())
    .optional(),
  orderDate: z.coerce.date().optional(),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  source: z.enum(ORDER_STATUS_EVENT_SOURCES).default("DASHBOARD"),
  reason: z.string().trim().max(240).optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(240).optional().or(z.literal("")),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
