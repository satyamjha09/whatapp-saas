import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

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

const optionalTrimmedString = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).max(240).optional(),
);

export const tallySalesOrderItemSchema = z.object({
  tallyStockItemId: z.string().trim().min(1, "Tally stock item ID is required"),
  tallyStockItemName: z.string().trim().min(1, "Stock item name is required"),
  sku: optionalTrimmedString,
  retailerId: optionalTrimmedString,
  quantity: z.coerce.number().int().min(1).max(999_999),
  unitPrice: nonNegativeAmountSchema,
  tax: nonNegativeAmountSchema.optional(),
  discount: nonNegativeAmountSchema.optional(),
  lineTotal: nonNegativeAmountSchema.optional(),
});

export const tallySalesOrderSchema = z.object({
  externalOrderId: z.string().trim().min(1, "Tally order ID is required").max(160),
  orderNumber: z.string().trim().min(1, "Order number is required").max(120),
  ledgerId: z.string().trim().min(1, "Tally ledger ID is required").max(160),
  ledgerName: z.string().trim().min(1, "Tally ledger name is required").max(240),
  customerPhone: optionalTrimmedString,
  customerEmail: optionalTrimmedString,
  customerGstin: optionalTrimmedString,
  status: z.string().trim().max(120).optional().default("Sales Order"),
  currency: z.string().trim().min(3).max(3).default("INR").transform((value) => value.toUpperCase()),
  subtotal: nonNegativeAmountSchema.optional(),
  tax: nonNegativeAmountSchema.optional(),
  discount: nonNegativeAmountSchema.optional(),
  shipping: nonNegativeAmountSchema.optional(),
  total: nonNegativeAmountSchema.optional(),
  orderDate: z.coerce.date().optional(),
  narration: z.string().trim().max(1000).optional().or(z.literal("")),
  items: z.array(tallySalesOrderItemSchema).min(1).max(300),
});

export const syncTallyOrdersSchema = z.object({
  tallyCompanyId: z.string().trim().min(1, "Tally company ID is required").max(160),
  orders: z.array(tallySalesOrderSchema).min(1).max(500),
});

export const listTallySyncRunsQuerySchema = z.object({
  tallyCompanyId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const listTallyMappingsQuerySchema = z.object({
  tallyCompanyId: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  onlyUnmapped: z.coerce.boolean().default(false),
});

export const updateTallyCustomerMappingSchema = z.object({
  contactId: z.string().trim().min(1, "Contact is required"),
});

export const updateTallyProductMappingSchema = z.object({
  localProductId: z.string().trim().min(1, "Product is required"),
});

export type SyncTallyOrdersInput = z.infer<typeof syncTallyOrdersSchema>;
export type TallySalesOrderInput = z.infer<typeof tallySalesOrderSchema>;
export type TallySalesOrderItemInput = z.infer<typeof tallySalesOrderItemSchema>;
export type ListTallySyncRunsQuery = z.infer<typeof listTallySyncRunsQuerySchema>;
export type ListTallyMappingsQuery = z.infer<typeof listTallyMappingsQuerySchema>;
export type UpdateTallyCustomerMappingInput = z.infer<typeof updateTallyCustomerMappingSchema>;
export type UpdateTallyProductMappingInput = z.infer<typeof updateTallyProductMappingSchema>;
