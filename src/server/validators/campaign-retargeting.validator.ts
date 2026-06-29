import { z } from "zod";

export const campaignRetargetingPresetSchema = z.enum([
  "READ_NOT_REPLIED",
  "DELIVERED_NOT_READ",
  "FAILED",
  "REPLIED",
  "NOT_REPLIED",
]);

export const createCampaignRetargetingSegmentSchema = z.object({
  preset: campaignRetargetingPresetSchema,
  segmentName: z.string().trim().min(1).max(120).optional(),
});

export type CampaignRetargetingPreset = z.infer<
  typeof campaignRetargetingPresetSchema
>;
