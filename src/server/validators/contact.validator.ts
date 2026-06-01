import { z } from "zod";

export const createContactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .optional()
    .or(z.literal("")),

  countryCode: z
    .string()
    .trim()
    .min(1, "Country code is required")
    .max(5, "Country code must be less than 5 characters")
    .regex(/^\d+$/, "Country code must contain only numbers"),

  phoneNumber: z
    .string()
    .trim()
    .min(7, "Phone number must be at least 7 digits")
    .max(15, "Phone number must be less than 15 digits")
    .regex(/^\d+$/, "Phone number must contain only numbers"),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;
