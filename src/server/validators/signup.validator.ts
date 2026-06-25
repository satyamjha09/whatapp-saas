import { z } from "zod";

export const SignupAccountDetailsSchema = z.object({
  businessName: z.string().min(2, "Business name is required"),
  businessCategory: z.string().min(1, "Business category is required"),

  personalName: z.string().min(2, "Personal name is required"),

  email: z.string().email("Valid email is required"),

  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter valid 10-digit mobile number"),

  city: z.string().min(2, "City is required"),
  pinCode: z.string().regex(/^\d{6}$/, "Enter valid 6-digit PIN code"),

  employeeCode: z.string().optional().nullable(),

  whatsappUpdatesConsent: z.boolean().default(false),
});

export type SignupAccountDetailsInput = z.infer<
  typeof SignupAccountDetailsSchema
>;
