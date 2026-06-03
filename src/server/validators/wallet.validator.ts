import { z } from "zod";

export const topUpWalletSchema = z.object({
  amountPaise: z
    .number()
    .int("Amount must be an integer")
    .min(100, "Minimum top-up is Rs 1")
    .max(10000000, "Maximum top-up is Rs 1,00,000"),

  description: z
    .string()
    .trim()
    .max(200, "Description must be less than 200 characters")
    .optional(),
});

export type TopUpWalletInput = z.infer<typeof topUpWalletSchema>;
