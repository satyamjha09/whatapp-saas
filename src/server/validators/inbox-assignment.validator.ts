import { InboxAssignmentMode, InboxAssignmentSource } from "@/generated/prisma/client";
import { z } from "zod";

export const inboxAssignmentModeSchema = z.nativeEnum(InboxAssignmentMode);
export const inboxAssignmentSourceSchema = z.nativeEnum(InboxAssignmentSource);

export const assignConversationSchema = z.object({
  assignedToUserId: z.string().trim().min(1).nullable().optional(),
  queueId: z.string().trim().min(1).nullable().optional(),
  assignmentMode: inboxAssignmentModeSchema.optional(),
  requiredSkillIds: z.array(z.string().trim().min(1)).max(20).optional(),
  reason: z.string().trim().max(500).nullable().optional(),
  source: inboxAssignmentSourceSchema.optional(),
});

export const routeConversationSchema = z.object({
  inboundText: z.string().trim().max(4096).optional(),
  requestedQueueId: z.string().trim().min(1).nullable().optional(),
  handoffReason: z.string().trim().max(500).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AssignConversationInput = z.infer<typeof assignConversationSchema>;
export type RouteConversationInput = z.infer<typeof routeConversationSchema>;
