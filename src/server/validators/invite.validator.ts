import { z } from "zod";

export const createCompanyInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .max(255, "Email is too long"),
  role: z.enum(["ADMIN", "MEMBER"]),
});

export type CreateCompanyInviteInput = z.infer<
  typeof createCompanyInviteSchema
>;
