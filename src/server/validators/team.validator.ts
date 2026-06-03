import { z } from "zod";

export const updateMemberRoleSchema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
