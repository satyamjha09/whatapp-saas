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
