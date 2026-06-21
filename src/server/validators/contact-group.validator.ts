import { z } from "zod";

const digits = (value: string) => value.replace(/\D/g, "");

export const createContactGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(80),
  description: z.string().trim().max(300).optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-f]{6}$/i, "Choose a valid group color")
    .optional(),
});

export const contactGroupImportRowSchema = z
  .object({
    countryCode: z
      .string()
      .trim()
      .refine((value) => {
        const normalized = digits(value);
        return normalized.length >= 1 && normalized.length <= 4;
      }, "Country code must contain 1 to 4 digits"),
    phoneNumber: z
      .string()
      .trim()
      .refine(
        (value) => digits(value).length >= 7,
        "Phone number must contain at least 7 digits",
      ),
    name: z.string().trim().max(100).optional(),
    source: z.string().trim().max(80).optional(),
  })
  .superRefine((contact, context) => {
    if (
      (digits(contact.countryCode) + digits(contact.phoneNumber)).length > 15
    ) {
      context.addIssue({
        code: "custom",
        path: ["phoneNumber"],
        message: "Complete phone number cannot exceed 15 digits",
      });
    }
  });

export const importContactsToGroupSchema = z.object({
  contacts: z
    .array(contactGroupImportRowSchema)
    .min(1, "Add at least one contact")
    .max(2000, "You can import maximum 2,000 contacts at once"),
});

export type CreateContactGroupInput = z.infer<
  typeof createContactGroupSchema
>;
export type ImportContactsToGroupInput = z.infer<
  typeof importContactsToGroupSchema
>;
