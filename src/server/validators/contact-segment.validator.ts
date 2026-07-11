import { z } from "zod";

export const SegmentRuleFieldSchema = z.enum([
  "PHONE",
  "NAME",
  "EMAIL",
  "COMPANY_NAME",
  "SOURCE",
  "CITY",
  "TAG",
  "OPTED_OUT",
  "MARKETING_CONSENT",
  "UTILITY_CONSENT",
  "CREATED_AT",
  "LAST_MESSAGE_AT",
  "CUSTOM_FIELD",
  "CAMPAIGN_OUTCOME",
  "LEAD_SCORE",
]);

export const SegmentRuleOperatorSchema = z.enum([
  "EQUALS",
  "NOT_EQUALS",
  "CONTAINS",
  "NOT_CONTAINS",
  "STARTS_WITH",
  "ENDS_WITH",
  "IN",
  "NOT_IN",
  "EXISTS",
  "NOT_EXISTS",
  "BEFORE",
  "AFTER",
  "BETWEEN",
  "GREATER_THAN",
  "LESS_THAN",
  "IN_LAST_DAYS",
  "NOT_IN_LAST_DAYS",
  "IS_TRUE",
  "IS_FALSE",
]);

export const SegmentRuleSchema = z.object({
  field: SegmentRuleFieldSchema,
  operator: SegmentRuleOperatorSchema,
  customFieldKey: z.string().max(60).optional().nullable(),
  value: z.string().max(500).optional().nullable(),
  values: z.unknown().optional(),
});

export const CreateSegmentSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional().nullable(),
  matchMode: z.enum(["ALL", "ANY"]).default("ALL"),
  rules: z.array(SegmentRuleSchema).max(25),
});

export const UpdateSegmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  matchMode: z.enum(["ALL", "ANY"]).optional(),
  rules: z.array(SegmentRuleSchema).max(25).optional(),
});

export const PreviewSegmentRulesSchema = z.object({
  matchMode: z.enum(["ALL", "ANY"]).default("ALL"),
  rules: z.array(SegmentRuleSchema).max(25),
});

export const SegmentContactsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const ContactsListQuerySchema = z.object({
  search: z.string().max(200).optional(),
  listId: z.string().optional(),
  segmentId: z.string().optional(),
  tag: z.string().max(60).optional(),
  source: z.string().max(80).optional(),
  status: z.enum(["active", "blocked"]).optional(),
  consent: z
    .enum([
      "marketing_granted",
      "marketing_unknown",
      "marketing_revoked",
      "utility_granted",
      "utility_unknown",
      "utility_revoked",
      "opted_out",
    ])
    .optional(),
  optedOut: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
