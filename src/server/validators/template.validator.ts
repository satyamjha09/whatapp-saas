import { z } from "zod";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getComponentsRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

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
}).superRefine((value, context) => {
  const components = getComponentsRecord(value.components);

  if (
    components.templateType &&
    components.templateType !== value.templateType
  ) {
    context.addIssue({
      code: "custom",
      message: "Component template type must match selected template type",
      path: ["components"],
    });
  }

  if (value.templateType === "CAROUSEL") {
    const cards = Array.isArray(components.cards) ? components.cards : [];

    if (cards.length < 2) {
      context.addIssue({
        code: "custom",
        message: "Carousel templates need at least 2 cards",
        path: ["components", "cards"],
      });
    }

    if (cards.length > 10) {
      context.addIssue({
        code: "custom",
        message: "Carousel templates cannot have more than 10 cards",
        path: ["components", "cards"],
      });
    }

    cards.forEach((card, index) => {
      if (!isRecord(card)) {
        context.addIssue({
          code: "custom",
          message: "Carousel card must be an object",
          path: ["components", "cards", index],
        });
        return;
      }

      if (!["IMAGE", "VIDEO"].includes(String(card.headerType ?? ""))) {
        context.addIssue({
          code: "custom",
          message: "Carousel card header type must be IMAGE or VIDEO",
          path: ["components", "cards", index, "headerType"],
        });
      }

      if (typeof card.body !== "string" || card.body.trim().length < 1) {
        context.addIssue({
          code: "custom",
          message: "Carousel card body is required",
          path: ["components", "cards", index, "body"],
        });
      }
    });
  }

  if (value.templateType !== "CAROUSEL" && Array.isArray(components.cards)) {
    context.addIssue({
      code: "custom",
      message: "Cards are only supported for carousel templates",
      path: ["components", "cards"],
    });
  }
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
