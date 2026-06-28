import { z } from "zod";

export const createTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Template name must be at least 2 characters")
    .max(80, "Template name must be less than 80 characters")
    .regex(
      /^[a-z0-9_]+$/,
      "Template name can only contain lowercase letters, numbers, and underscores",
    ),

  language: z
    .string()
    .trim()
    .min(2, "Language is required")
    .max(20, "Language must be less than 20 characters"),

  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),

  templateType: z
    .enum(["STANDARD", "CAROUSEL", "MEDIA", "CATALOG"])
    .default("STANDARD"),

  body: z
    .string()
    .trim()
    .min(5, "Template body must be at least 5 characters")
    .max(1024, "Template body must be less than 1024 characters"),

  components: z.unknown().optional(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
