import { z } from "zod";
import { InboxAgentAvailabilityStatus } from "@/generated/prisma/client";

export const upsertInboxAgentProfileSchema = z.object({
  userId: z.string().trim().min(1, "User is required"),
  availabilityStatus: z.enum(InboxAgentAvailabilityStatus).default("OFFLINE"),
  acceptingNew: z.coerce.boolean().default(true),
  maxOpenConversations: z.coerce.number().int().min(1).max(500).default(25),
  preferredLanguage: z
    .string()
    .trim()
    .max(20)
    .optional()
    .transform((value) => (value ? value : null)),
  timezone: z.string().trim().min(2).max(80).default("Asia/Kolkata"),
});

export const assignInboxAgentSkillSchema = z.object({
  userId: z.string().trim().min(1, "User is required"),
  skillId: z.string().trim().min(1, "Skill is required"),
  level: z.coerce.number().int().min(1).max(5).default(1),
});

export type UpsertInboxAgentProfileInput = z.infer<
  typeof upsertInboxAgentProfileSchema
>;
export type AssignInboxAgentSkillInput = z.infer<
  typeof assignInboxAgentSkillSchema
>;
