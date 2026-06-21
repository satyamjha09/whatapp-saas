import { z } from "zod";

const phoneDigits = (value: string) => value.replace(/\D/g, "");

export const sendSingleTemplateMessageSchema = z
  .object({
    phoneNumber: z
      .string()
      .trim()
      .refine(
        (value) => phoneDigits(value).length >= 8,
        "Phone number must contain at least 8 digits",
      ),
    countryCode: z
      .string()
      .trim()
      .refine(
        (value) => {
          const digits = phoneDigits(value);
          return digits.length >= 1 && digits.length <= 4;
        },
        "Country code must contain 1 to 4 digits",
      ),
    name: z.string().trim().max(100, "Name is too long").optional(),
    templateId: z.string().trim().min(1, "Template is required"),
    bodyParameters: z
      .array(z.string().trim().min(1, "Parameter value cannot be empty"))
      .default([]),
  })
  .superRefine((input, context) => {
    const completeNumber =
      phoneDigits(input.countryCode) + phoneDigits(input.phoneNumber);

    if (completeNumber.length > 15) {
      context.addIssue({
        code: "custom",
        path: ["phoneNumber"],
        message: "Country code and phone number cannot exceed 15 digits",
      });
    }
  });

export type SendSingleTemplateMessageInput = z.infer<
  typeof sendSingleTemplateMessageSchema
>;
