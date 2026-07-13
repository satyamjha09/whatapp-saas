import { z } from "zod";

export const sendOrderStatusUpdateSchema = z.object({
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "Idempotency key must be at least 8 characters")
    .max(160, "Idempotency key is too long")
    .optional(),
  templateId: z.string().trim().min(1, "Template is required"),
});

export type SendOrderStatusUpdateInput = z.infer<
  typeof sendOrderStatusUpdateSchema
>;
