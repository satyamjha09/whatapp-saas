import { z } from "zod";

export const updateSystemMaintenanceModeSchema = z.object({
  enabled: z.boolean(),
  message: z
    .string()
    .trim()
    .max(500, "Message must be 500 characters or less")
    .optional()
    .nullable(),
});
