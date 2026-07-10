import { z } from "zod";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_TYPES,
} from "@/lib/whatsapp-template/template-definition";
import { validatePublicMediaUrl } from "@/lib/whatsapp-template/media-url-policy";
import {
  validateCarouselCardButtons,
  validateTemplateButtons,
} from "@/lib/whatsapp-template/template-button-rules";

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

  category: z.enum(TEMPLATE_CATEGORIES),

  templateType: z.enum(TEMPLATE_TYPES).default("STANDARD"),

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

    validateCarouselCardButtons(cards).forEach((issue) => {
      context.addIssue({
        code: "custom",
        message: issue.message,
        path: ["components", "cards", issue.index ?? 0, "buttons"],
      });
    });
  }

  if (value.templateType !== "CAROUSEL" && Array.isArray(components.cards)) {
    context.addIssue({
      code: "custom",
      message: "Cards are only supported for carousel templates",
      path: ["components", "cards"],
    });
  }

  const componentList = Array.isArray(components.components)
    ? components.components
    : [];
  const buttonsComponent = componentList.find(
    (component) =>
      isRecord(component) &&
      String(component.type ?? "").toUpperCase() === "BUTTONS",
  );

  if (isRecord(buttonsComponent) && Array.isArray(buttonsComponent.buttons)) {
    validateTemplateButtons({
      buttons: buttonsComponent.buttons,
      templateCategory: value.category,
      templateType: value.templateType,
    }).forEach((issue) => {
      context.addIssue({
        code: "custom",
        message: issue.message,
        path: ["components", "components", "buttons", issue.index ?? 0],
      });
    });
  }

  componentList.forEach((component, index) => {
    if (!isRecord(component)) return;

    if (String(component.type ?? "").toUpperCase() !== "HEADER") return;

    const format = String(component.format ?? "NONE").toUpperCase();

    if (
      !["TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION", "NONE"].includes(
        format,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Header format is not supported",
        path: ["components", "components", index, "format"],
      });
    }

    if (format === "TEXT") {
      const text = typeof component.text === "string" ? component.text.trim() : "";

      if (!text) {
        context.addIssue({
          code: "custom",
          message: "Text header requires header text",
          path: ["components", "components", index, "text"],
        });
      }
    }

    if (["IMAGE", "VIDEO", "DOCUMENT"].includes(format)) {
      if (typeof component.mediaAssetId !== "string" || !component.mediaAssetId.trim()) {
        context.addIssue({
          code: "custom",
          message: "Media header requires an uploaded media asset",
          path: ["components", "components", index, "mediaAssetId"],
        });
      }

      const mediaUrl =
        typeof component.publicUrl === "string"
          ? component.publicUrl
          : typeof component.mediaUrl === "string"
            ? component.mediaUrl
            : "";

      if (mediaUrl) {
        const result = validatePublicMediaUrl(mediaUrl);

        if (!result.ok) {
          context.addIssue({
            code: "custom",
            message: result.reason ?? "Header media URL is not allowed",
            path: ["components", "components", index, "mediaUrl"],
          });
        }
      }
    }
  });
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
