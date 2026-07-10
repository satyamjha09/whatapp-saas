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

  if (value.category === "AUTHENTICATION" && value.templateType !== "AUTHENTICATION") {
    context.addIssue({
      code: "custom",
      message: "Authentication templates must use the dedicated authentication builder",
      path: ["templateType"],
    });
  }

  if (value.templateType === "AUTHENTICATION") {
    const auth = isRecord(components.authentication)
      ? components.authentication
      : {};
    const mode = String(auth.mode ?? "").toUpperCase();

    if (value.category !== "AUTHENTICATION") {
      context.addIssue({
        code: "custom",
        message: "Authentication templates must use the Authentication category",
        path: ["category"],
      });
    }

    if (!["COPY_CODE", "ONE_TAP", "ZERO_TAP"].includes(mode)) {
      context.addIssue({
        code: "custom",
        message: "Authentication template mode must be Copy Code, One-Tap, or Zero-Tap",
        path: ["components", "authentication", "mode"],
      });
    }

    if (mode !== "COPY_CODE") {
      if (
        typeof auth.androidPackageName !== "string" ||
        !auth.androidPackageName.trim()
      ) {
        context.addIssue({
          code: "custom",
          message: "One-Tap and Zero-Tap templates require Android package details",
          path: ["components", "authentication", "androidPackageName"],
        });
      }

      if (
        typeof auth.androidSignatureHash !== "string" ||
        !auth.androidSignatureHash.trim()
      ) {
        context.addIssue({
          code: "custom",
          message: "One-Tap and Zero-Tap templates require an app signing hash",
          path: ["components", "authentication", "androidSignatureHash"],
        });
      }
    }

    const componentList = Array.isArray(components.components)
      ? components.components
      : [];
    const buttonsComponent = componentList.find(
      (component) =>
        isRecord(component) &&
        String(component.type ?? "").toUpperCase() === "BUTTONS",
    );
    const authButtons =
      isRecord(buttonsComponent) && Array.isArray(buttonsComponent.buttons)
        ? buttonsComponent.buttons.filter(isRecord)
        : [];

    if (authButtons.length !== 1) {
      context.addIssue({
        code: "custom",
        message: "Authentication templates require exactly one OTP button",
        path: ["components", "components", "buttons"],
      });
    }

    const buttonType = String(authButtons[0]?.type ?? "").toUpperCase();
    if (mode === "COPY_CODE") {
      if (buttonType !== "COPY_CODE") {
        context.addIssue({
          code: "custom",
          message: "Copy Code authentication templates require a Copy Code button",
          path: ["components", "components", "buttons"],
        });
      }

      if (typeof authButtons[0]?.example !== "string" || !authButtons[0]?.example.trim()) {
        context.addIssue({
          code: "custom",
          message: "Copy Code authentication templates require a sample OTP code",
          path: ["components", "components", "buttons"],
        });
      }
    }

    if (mode === "ONE_TAP" && buttonType !== "ONE_TAP") {
      context.addIssue({
        code: "custom",
        message: "One-Tap authentication templates require a One-Tap button",
        path: ["components", "components", "buttons"],
      });
    }

    if (mode === "ZERO_TAP" && buttonType !== "ZERO_TAP") {
      context.addIssue({
        code: "custom",
        message: "Zero-Tap authentication templates require a Zero-Tap button",
        path: ["components", "components", "buttons"],
      });
    }
  }

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

      if (
        typeof card.mediaAssetId !== "string" ||
        !card.mediaAssetId.trim()
      ) {
        context.addIssue({
          code: "custom",
          message: "Each carousel card needs an uploaded image or video asset",
          path: ["components", "cards", index, "mediaAssetId"],
        });
      }

      const cardComponents = Array.isArray(card.components)
        ? card.components
        : [];
      const headerComponent = cardComponents.find(
        (component) =>
          isRecord(component) &&
          String(component.type ?? "").toUpperCase() === "HEADER",
      );

      if (
        isRecord(headerComponent) &&
        !isRecord(headerComponent.example) &&
        typeof headerComponent.metaHandle !== "string"
      ) {
        context.addIssue({
          code: "custom",
          message: "Each carousel media asset must include a Meta review sample",
          path: ["components", "cards", index, "mediaAssetId"],
        });
      }
    });

    const firstPattern = cards
      .slice(0, 1)
      .map((card) =>
        isRecord(card) && Array.isArray(card.buttons)
          ? card.buttons
              .filter(isRecord)
              .map((button) => String(button.type ?? "").toUpperCase())
              .join("|")
          : "",
      )[0];

    cards.forEach((card, index) => {
      const pattern =
        isRecord(card) && Array.isArray(card.buttons)
          ? card.buttons
              .filter(isRecord)
              .map((button) => String(button.type ?? "").toUpperCase())
              .join("|")
          : "";

      if (pattern !== firstPattern) {
        context.addIssue({
          code: "custom",
          message: "All carousel cards must use the same button pattern",
          path: ["components", "cards", index, "buttons"],
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

  if (
    value.templateType !== "AUTHENTICATION" &&
    isRecord(buttonsComponent) &&
    Array.isArray(buttonsComponent.buttons)
  ) {
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
