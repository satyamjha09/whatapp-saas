import { z } from "zod";

export const createCampaignSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Campaign name must be at least 2 characters")
    .max(100, "Campaign name must be less than 100 characters"),

  templateId: z.string().min(1, "Template is required"),

  contactIds: z
    .array(z.string().min(1))
    .min(1, "Select at least one contact"),

  variables: z
    .array(z.string().trim().min(1, "Variable value cannot be empty"))
    .default([]),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export const createCampaignSequenceStepSchema = z.object({
  condition: z
    .enum(["NO_REPLY", "OPENED", "CLICKED"])
    .default("NO_REPLY"),
  delayMinutes: z.coerce
    .number()
    .int()
    .min(0, "Delay cannot be negative")
    .max(60 * 24 * 365, "Delay cannot be longer than one year"),
  isActive: z.boolean().default(true),
  order: z.coerce
    .number()
    .int()
    .min(1, "Step order must be at least 1")
    .max(50, "A sequence can have at most 50 steps"),
  templateId: z.string().min(1, "Template is required"),
  variables: z
    .array(z.string().trim().min(1, "Variable value cannot be empty"))
    .default([]),
});

export type CreateCampaignSequenceStepInput = z.infer<
  typeof createCampaignSequenceStepSchema
>;
