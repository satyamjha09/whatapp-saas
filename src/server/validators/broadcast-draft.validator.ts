import { z } from "zod";

export const BROADCAST_WIZARD_STEPS = [
  "SETUP",
  "AUDIENCE",
  "TEMPLATE",
  "PERSONALISE",
  "SCHEDULE",
  "REVIEW",
] as const;

export const broadcastObjectiveSchema = z.enum([
  "PROMOTION",
  "ANNOUNCEMENT",
  "PAYMENT_REMINDER",
  "ORDER_UPDATE",
  "CUSTOMER_RE_ENGAGEMENT",
  "EVENT_INVITE",
  "OTHER",
]);

export const broadcastDraftDataSchema = z
  .object({
    audience: z
      .object({
        city: z.string().optional().nullable(),
        groupIds: z.array(z.string()).default([]).optional(),
        requireMarketingConsent: z.boolean().default(true).optional(),
        segmentIds: z.array(z.string()).default([]).optional(),
        source: z.string().optional().nullable(),
        tag: z.string().optional().nullable(),
        estimatedRecipients: z.number().int().nonnegative().optional(),
      })
      .partial()
      .optional(),
    personalisation: z
      .object({
        mappings: z
          .record(
            z.string(),
            z.object({
              customValue: z.string().optional().nullable(),
              fallback: z.string().optional().nullable(),
              source: z
                .enum([
                  "CONTACT_NAME",
                  "PHONE_NUMBER",
                  "CITY",
                  "SOURCE",
                  "CUSTOM",
                ])
                .default("CONTACT_NAME"),
            }),
          )
          .default({})
          .optional(),
        previewContactId: z.string().optional().nullable(),
        testRecipient: z
          .object({
            countryCode: z.string().optional().nullable(),
            name: z.string().optional().nullable(),
            phoneNumber: z.string().optional().nullable(),
          })
          .partial()
          .optional(),
      })
      .partial()
      .optional(),
    schedule: z
      .object({
        businessHoursEnd: z.string().optional().nullable(),
        businessHoursOnly: z.boolean().optional(),
        businessHoursStart: z.string().optional().nullable(),
        recipientTimezoneScheduling: z.boolean().optional(),
        recurring: z
          .object({
            enabled: z.boolean().default(false).optional(),
            endsAt: z.string().optional().nullable(),
            frequency: z
              .enum(["DAILY", "WEEKLY", "MONTHLY"])
              .optional()
              .nullable(),
            interval: z.number().int().min(1).max(12).optional().nullable(),
          })
          .partial()
          .optional(),
        scheduledAt: z.string().optional().nullable(),
        sendMode: z.enum(["NOW", "SCHEDULED"]).optional(),
        timezone: z.string().optional().nullable(),
      })
      .partial()
      .optional(),
    template: z
      .object({
        body: z.string().optional().nullable(),
        category: z.string().optional().nullable(),
        language: z.string().optional().nullable(),
        templateId: z.string().optional().nullable(),
        templateName: z.string().optional().nullable(),
        variables: z.array(z.string()).default([]).optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough()
  .default({});

export const createBroadcastDraftSchema = z.object({
  currentStep: z.coerce.number().int().min(1).max(6).default(1),
  draftData: broadcastDraftDataSchema,
  name: z
    .string()
    .trim()
    .min(2, "Campaign name must be at least 2 characters")
    .max(100, "Campaign name must be less than 100 characters"),
  objective: broadcastObjectiveSchema,
});

export const updateBroadcastDraftSchema = createBroadcastDraftSchema.partial({
  currentStep: true,
  draftData: true,
  name: true,
  objective: true,
});

export type BroadcastDraftData = z.infer<typeof broadcastDraftDataSchema>;
export type CreateBroadcastDraftInput = z.infer<
  typeof createBroadcastDraftSchema
>;
export type UpdateBroadcastDraftInput = z.infer<
  typeof updateBroadcastDraftSchema
>;

export const broadcastAudiencePreviewSchema = z.object({
  filters: z
    .object({
      city: z.string().max(100).optional().nullable(),
      source: z.string().max(100).optional().nullable(),
      tag: z.string().max(100).optional().nullable(),
    })
    .default({}),
  groupIds: z.array(z.string().min(1)).max(20).default([]),
  requireMarketingConsent: z.boolean().default(true),
  segmentIds: z.array(z.string().min(1)).max(20).default([]),
});

export type BroadcastAudiencePreviewInput = z.infer<
  typeof broadcastAudiencePreviewSchema
>;

export const broadcastLaunchControlSchema = z.object({
  action: z.enum(["SEND_NOW", "SCHEDULE_LATER"]),
  idempotencyKey: z.string().trim().min(12).max(160).optional().nullable(),
  schedule: z
    .object({
      businessHoursEnd: z.string().optional().nullable(),
      businessHoursOnly: z.boolean().default(false).optional(),
      businessHoursStart: z.string().optional().nullable(),
      recipientTimezoneScheduling: z.boolean().default(false).optional(),
      recurring: z
        .object({
          enabled: z.boolean().default(false).optional(),
          endsAt: z.string().optional().nullable(),
          frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional().nullable(),
          interval: z.number().int().min(1).max(12).optional().nullable(),
        })
        .partial()
        .optional(),
      scheduledAt: z.string().optional().nullable(),
      timezone: z.string().optional().nullable(),
    })
    .optional(),
});

export type BroadcastLaunchControlInput = z.infer<
  typeof broadcastLaunchControlSchema
>;
