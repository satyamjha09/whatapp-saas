import { z } from "zod";

const phoneDigits = (value: string) => value.replace(/\D/g, "");

const mediaTypes = ["IMAGE", "DOCUMENT", "VIDEO", "AUDIO"] as const;

export const sendSingleTemplateMessageSchema = z
  .object({
    messageType: z.enum(["Template", "Media"]).default("Template"),
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
    templateId: z.string().trim().optional(),
    bodyParameters: z
      .array(z.string().trim().min(1, "Parameter value cannot be empty"))
      .default([]),
    media: z
      .object({
        type: z.enum(mediaTypes),
        url: z
          .string()
          .trim()
          .url("Media URL must be a valid public URL")
          .optional(),
        id: z.string().trim().min(1, "Media ID is required").optional(),
        name: z.string().trim().max(255, "Media name is too long").optional(),
        caption: z.string().trim().max(1024, "Caption is too long").optional(),
      })
      .optional(),
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

    if (input.messageType === "Template" && !input.templateId?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["templateId"],
        message: "Template is required",
      });
    }

    if (input.messageType === "Media" && !input.media) {
      context.addIssue({
        code: "custom",
        path: ["media"],
        message: "Media is required",
      });
    }

    if (
      input.messageType === "Media" &&
      input.media &&
      !input.media.url &&
      !input.media.id
    ) {
      context.addIssue({
        code: "custom",
        path: ["media"],
        message: "Media URL or uploaded media ID is required",
      });
    }
  });

export type SendSingleTemplateMessageInput = z.infer<
  typeof sendSingleTemplateMessageSchema
>;
