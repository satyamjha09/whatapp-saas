import { InboxAssignmentMode } from "@/generated/prisma/client";
import { z } from "zod";

export const inboxRoutingConditionFieldSchema = z.enum([
  "MESSAGE_CONTAINS",
  "MESSAGE_LANGUAGE",
  "CONTACT_TAG",
  "CONTACT_CITY",
  "CONTACT_SOURCE",
  "LEAD_SCORE",
  "LIFECYCLE_STAGE",
  "CAMPAIGN_SOURCE",
  "WHATSAPP_NUMBER",
  "BUSINESS_HOURS",
  "CHATBOT_HANDOFF_REASON",
]);

export const inboxRoutingOperatorSchema = z.enum([
  "EQUALS",
  "NOT_EQUALS",
  "CONTAINS",
  "IN",
  "GT",
  "GTE",
  "LT",
  "LTE",
  "EXISTS",
]);

export const inboxRoutingConditionSchema = z.object({
  field: inboxRoutingConditionFieldSchema,
  operator: inboxRoutingOperatorSchema.default("EQUALS"),
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.union([z.string(), z.number(), z.boolean()])),
    z.null(),
  ]).optional(),
});

export const inboxRoutingRuleStatusSchema = z.enum(["ACTIVE", "DISABLED"]);

export const createInboxRoutingRuleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  priority: z.coerce.number().int().min(1).max(10000).default(100),
  status: inboxRoutingRuleStatusSchema.default("ACTIVE"),
  conditions: z.array(inboxRoutingConditionSchema).min(1).max(20),
  targetQueueId: z.string().trim().min(1),
  assignmentMode: z.nativeEnum(InboxAssignmentMode).nullable().optional(),
  requiredSkillIds: z.array(z.string().trim().min(1)).max(20).optional(),
  fallbackQueueId: z.string().trim().min(1).nullable().optional(),
});

export const updateInboxRoutingRuleSchema = createInboxRoutingRuleSchema.partial();

export type CreateInboxRoutingRuleInput = z.infer<typeof createInboxRoutingRuleSchema>;
export type UpdateInboxRoutingRuleInput = z.infer<typeof updateInboxRoutingRuleSchema>;
