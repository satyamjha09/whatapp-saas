import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens");

export const createInboxSkillSchema = z.object({
  name: z.string().trim().min(2, "Skill name is required").max(80),
  slug: slugSchema.optional(),
  description: z
    .string()
    .trim()
    .max(240)
    .optional()
    .transform((value) => (value ? value : null)),
});

export const updateInboxSkillSchema = createInboxSkillSchema.partial();

export const queueRequiredSkillSchema = z.object({
  skillId: z.string().trim().min(1, "Skill is required"),
  minimumLevel: z.coerce.number().int().min(1).max(5).default(1),
});

export type CreateInboxSkillInput = z.infer<typeof createInboxSkillSchema>;
export type UpdateInboxSkillInput = z.infer<typeof updateInboxSkillSchema>;
export type QueueRequiredSkillInput = z.infer<typeof queueRequiredSkillSchema>;
