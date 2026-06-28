import { z } from "zod";

const digits = (value: string) => value.replace(/\D/g, "");

export const bulkMessageRecipientSchema = z
  .object({
    countryCode: z
      .string()
      .trim()
      .refine((value) => {
        const valueDigits = digits(value);
        return valueDigits.length >= 1 && valueDigits.length <= 4;
      }, "Country code must contain 1 to 4 digits"),
    phoneNumber: z
      .string()
      .trim()
      .refine(
        (value) => digits(value).length >= 8,
        "Phone number must contain at least 8 digits",
      ),
    name: z.string().trim().max(100, "Name is too long").optional(),
    bodyParameters: z
      .array(z.string().trim().min(1, "Parameter value cannot be empty"))
      .default([]),
  })
  .superRefine((recipient, context) => {
    if (
      (digits(recipient.countryCode) + digits(recipient.phoneNumber)).length >
      15
    ) {
      context.addIssue({
        code: "custom",
        path: ["phoneNumber"],
        message: "Complete phone number cannot exceed 15 digits",
      });
    }
  });

export const sendBulkTemplateMessageSchema = z
  .object({
    templateId: z.string().trim().min(1, "Template is required"),
    groupId: z.string().trim().optional().nullable(),
    segmentId: z.string().trim().optional().nullable(),
    recipients: z
      .array(bulkMessageRecipientSchema)
      .max(10_000, "A bulk request cannot exceed 10,000 pasted recipients")
      .default([]),
    bodyParameters: z
      .array(z.string().trim().min(1, "Parameter value cannot be empty"))
      .default([]),
    scheduledAt: z.string().datetime().optional().nullable(),
  })
  .refine(
    (value) => Boolean(value.groupId) || Boolean(value.segmentId) || value.recipients.length > 0,
    {
      message: "Select a contact group, select a segment, or add at least one recipient",
      path: ["recipients"],
    },
  );

export type SendBulkTemplateMessageInput = z.infer<
  typeof sendBulkTemplateMessageSchema
>;
