import { z } from "zod";

const phoneDigits = (value: string) => value.replace(/\D/g, "");

const mediaTypes = ["IMAGE", "DOCUMENT", "VIDEO", "AUDIO"] as const;
const interactiveTypes = [
  "List Button",
  "Reply Button",
  "CTA Button",
  "Call Permission Request",
  "Location Request",
  "Address Request",
  "Flow",
] as const;

export const sendSingleTemplateMessageSchema = z
  .object({
    messageType: z
      .enum(["Template", "Media", "Text", "Location", "Interactive"])
      .default("Template"),
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
    contactId: z.string().trim().min(1).optional(),
    idempotencyKey: z.string().trim().min(1).max(160).optional(),
    templateId: z.string().trim().optional(),
    bodyParameters: z
      .array(z.string().trim().min(1, "Parameter value cannot be empty"))
      .default([]),
    catalog: z
      .object({
        selectedProductIds: z
          .array(z.string().trim().min(1).max(160))
          .max(30, "Catalog product selection is too large")
          .optional(),
        localProductIds: z
          .array(z.string().trim().min(1).max(160))
          .max(30, "Catalog product selection is too large")
          .optional(),
        productIds: z
          .array(z.string().trim().min(1).max(160))
          .max(30, "Catalog product selection is too large")
          .optional(),
      })
      .optional(),
    scheduledAt: z.string().datetime().optional().nullable(),
    text: z
      .object({
        body: z
          .string()
          .trim()
          .min(1, "Text message body is required")
          .max(4096, "Text message body is too long"),
      })
      .optional(),
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
    location: z
      .object({
        name: z.string().trim().min(1, "Location name is required").max(100),
        address: z
          .string()
          .trim()
          .min(1, "Location address is required")
          .max(1000),
        latitude: z.coerce
          .number()
          .min(-90, "Latitude must be between -90 and 90")
          .max(90, "Latitude must be between -90 and 90"),
        longitude: z.coerce
          .number()
          .min(-180, "Longitude must be between -180 and 180")
          .max(180, "Longitude must be between -180 and 180"),
      })
      .optional(),
    interactive: z
      .object({
        type: z.enum(interactiveTypes),
        header: z.string().trim().max(60, "Header is too long").optional(),
        body: z.string().trim().max(1024, "Body is too long").default(""),
        footer: z.string().trim().max(60, "Footer is too long").optional(),
        primaryButton: z
          .string()
          .trim()
          .max(20, "Button text is too long")
          .optional(),
        buttons: z
          .array(z.string().trim().min(1).max(20, "Button text is too long"))
          .max(3, "Reply buttons cannot exceed 3")
          .optional(),
        ctaUrl: z
          .string()
          .trim()
          .url("CTA URL must be valid")
          .optional(),
        flowId: z.string().trim().max(200).optional(),
        flowAction: z.string().trim().max(100).optional(),
        flowScreen: z.string().trim().max(100).optional(),
        sections: z
          .array(
            z.object({
              title: z.string().trim().max(24, "Section title is too long"),
              rows: z
                .array(
                  z.object({
                    title: z
                      .string()
                      .trim()
                      .min(1, "Row title is required")
                      .max(24, "Row title is too long"),
                    description: z
                      .string()
                      .trim()
                      .max(72, "Row description is too long")
                      .optional(),
                  }),
                )
                .min(1, "At least one row is required"),
            }),
          )
          .max(10, "List sections cannot exceed 10")
          .optional(),
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

    if (input.scheduledAt) {
      const scheduledAt = new Date(input.scheduledAt);

      if (
        Number.isNaN(scheduledAt.getTime()) ||
        scheduledAt.getTime() <= Date.now()
      ) {
        context.addIssue({
          code: "custom",
          path: ["scheduledAt"],
          message: "Schedule time must be in the future",
        });
      }
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

    if (input.messageType === "Text" && !input.text?.body.trim()) {
      context.addIssue({
        code: "custom",
        path: ["text"],
        message: "Text message body is required",
      });
    }

    if (input.messageType === "Location" && !input.location) {
      context.addIssue({
        code: "custom",
        path: ["location"],
        message: "Location is required",
      });
    }

    if (input.messageType === "Interactive" && !input.interactive) {
      context.addIssue({
        code: "custom",
        path: ["interactive"],
        message: "Interactive message details are required",
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

    if (input.messageType === "Interactive" && input.interactive) {
      const interactive = input.interactive;

      if (
        interactive.type !== "Call Permission Request" &&
        !interactive.body.trim()
      ) {
        context.addIssue({
          code: "custom",
          path: ["interactive"],
          message: "Interactive body is required",
        });
      }

      if (
        interactive.type === "List Button" &&
        (!interactive.primaryButton?.trim() ||
          !interactive.sections?.some((section) => section.rows.length > 0))
      ) {
        context.addIssue({
          code: "custom",
          path: ["interactive"],
          message: "List button text and at least one row are required",
        });
      }

      if (
        interactive.type === "Reply Button" &&
        !interactive.buttons?.some((button) => button.trim())
      ) {
        context.addIssue({
          code: "custom",
          path: ["interactive"],
          message: "At least one reply button is required",
        });
      }

      if (
        interactive.type === "CTA Button" &&
        (!interactive.primaryButton?.trim() || !interactive.ctaUrl?.trim())
      ) {
        context.addIssue({
          code: "custom",
          path: ["interactive"],
          message: "CTA button text and URL are required",
        });
      }

      if (
        interactive.type === "Flow" &&
        (!interactive.flowId?.trim() ||
          !interactive.primaryButton?.trim() ||
          !interactive.flowAction?.trim() ||
          !interactive.flowScreen?.trim())
      ) {
        context.addIssue({
          code: "custom",
          path: ["interactive"],
          message: "Flow, CTA text, action, and screen are required",
        });
      }
    }
  });

export type SendSingleTemplateMessageInput = z.infer<
  typeof sendSingleTemplateMessageSchema
>;
