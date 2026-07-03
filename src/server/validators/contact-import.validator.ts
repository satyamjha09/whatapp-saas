import { z } from "zod";

export const ContactImportColumnMappingSchema = z.object({
  phoneNumber: z.string().min(1),
  name: z.string().optional(),
  countryCode: z.string().optional(),
  email: z.string().optional(),
  companyName: z.string().optional(),
  tags: z.string().optional(),
  city: z.string().optional(),
  source: z.string().optional(),
  customAttributes: z.record(z.string(), z.string()).optional(),
  marketingConsentStatus: z.string().optional(),
  marketingConsentProof: z.string().optional(),
  marketingConsentSource: z.string().optional(),
});

export const ContactImportMappingSchema = z.object({
  columnMapping: ContactImportColumnMappingSchema,
  defaultCountryCode: z
    .string()
    .regex(/^\+?\d{1,4}$/, "Invalid country code")
    .optional(),
  duplicateStrategy: z
    .enum(["SKIP_EXISTING", "UPDATE_EXISTING", "CREATE_NEW_ONLY"])
    .default("SKIP_EXISTING"),
  tags: z.array(z.string().min(1).max(60)).max(20).optional(),
  contactListId: z.string().min(1).optional(),
  createListName: z.string().min(1).max(80).optional(),
});

export const ContactImportRowsQuerySchema = z.object({
  status: z
    .enum([
      "PENDING",
      "READY",
      "VALID",
      "INVALID",
      "DUPLICATE",
      "SKIPPED",
      "IMPORTED",
      "FAILED",
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export type ContactImportMappingInput = z.infer<typeof ContactImportMappingSchema>;
