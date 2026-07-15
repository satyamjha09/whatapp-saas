import { z } from "zod";
import { InboxAssignmentMode, InboxQueueMemberRole, InboxQueueStatus } from "@/generated/prisma/client";

const nullableString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null));

export const createInboxQueueSchema = z.object({
  name: z.string().trim().min(2, "Queue name is required").max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens")
    .optional(),
  description: nullableString,
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Use a hex color like #128C7E")
    .optional()
    .transform((value) => value ?? null),
  assignmentMode: z.enum(InboxAssignmentMode).default("MANUAL"),
  fallbackQueueId: nullableString,
  maxOpenPerAgent: z.coerce.number().int().min(1).max(500).optional().nullable(),
  approvalRequired: z.coerce.boolean().default(false),
});

export const updateInboxQueueSchema = createInboxQueueSchema.partial().extend({
  status: z.enum(InboxQueueStatus).optional(),
});

export const inboxQueueMemberSchema = z.object({
  userId: z.string().trim().min(1, "User is required"),
  role: z.enum(InboxQueueMemberRole).default("AGENT"),
  acceptingNew: z.coerce.boolean().default(true),
  maxOpenOverride: z.coerce.number().int().min(1).max(500).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(10000).default(0),
});

export const updateConversationQueueSchema = z.object({
  inboxQueueId: z.string().trim().min(1).nullable(),
});

export type CreateInboxQueueInput = z.infer<typeof createInboxQueueSchema>;
export type UpdateInboxQueueInput = z.infer<typeof updateInboxQueueSchema>;
export type InboxQueueMemberInput = z.infer<typeof inboxQueueMemberSchema>;
export type UpdateConversationQueueInput = z.infer<typeof updateConversationQueueSchema>;
