import { z } from "zod";

export const updateNotificationPreferenceSchema = z.object({
  type: z.enum([
    "BILLING",
    "WALLET",
    "WEBHOOK",
    "DEVELOPER_API",
    "CAMPAIGN",
    "SYSTEM",
  ]),
  inAppEnabled: z.boolean(),
  minimumSeverity: z.enum(["INFO", "SUCCESS", "WARNING", "ERROR"]),
  emailEnabled: z.boolean(),
  emailMinimumSeverity: z.enum(["INFO", "SUCCESS", "WARNING", "ERROR"]),
});
