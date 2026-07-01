import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be 80 characters or less"),
  mobile: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => value || null)
    .refine((value) => !value || /^[6-9]\d{9}$/.test(value), {
      message: "Enter valid 10-digit mobile number",
    }),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
