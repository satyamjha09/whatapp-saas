import { z } from "zod";

export const createApiKeySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "API key name must be at least 2 characters")
    .max(100, "API key name must be less than 100 characters"),
});

export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;
