import { z } from "zod";
import { InboxAgentAvailabilityStatus } from "@/generated/prisma/client";

export const inboxPresenceHeartbeatSchema = z.object({
  status: z.enum(InboxAgentAvailabilityStatus).default("AVAILABLE"),
  activeContactId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
});

export const inboxConversationPresenceSchema = z.object({
  viewer: z.coerce.boolean().optional(),
  typing: z.coerce.boolean().optional(),
});

export type InboxPresenceHeartbeatInput = z.infer<
  typeof inboxPresenceHeartbeatSchema
>;
export type InboxConversationPresenceInput = z.infer<
  typeof inboxConversationPresenceSchema
>;
