import { z } from "zod";

export const chatbotStatusSchema = z.enum([
  "DRAFT",
  "PUBLISHED",
  "PAUSED",
  "ARCHIVED",
]);

export const chatbotTriggerTypeSchema = z.enum([
  "KEYWORD",
  "REGEX",
  "TEMPLATE_MESSAGE",
  "CLICK_TO_WHATSAPP_AD",
  "DEFAULT_WELCOME",
  "MANUAL",
]);

export const simpleChatbotNodeTypeSchema = z.enum([
  "MESSAGE",
  "QUICK_REPLY",
  "LIST_MENU",
  "MEDIA_BUTTONS",
  "QUESTION",
  "CONDITION",
  "API_CALL",
  "CATALOG_PRODUCT_CARD",
  "PAYMENT_LINK",
  "TALLY_INVOICE_LOOKUP",
  "TALLY_LEDGER_BALANCE",
  "GOOGLE_SHEET_SAVE",
  "WEBHOOK",
  "AI_REPLY",
  "ASSIGN_AGENT",
]);

export const chatbotMediaTypeSchema = z.enum(["IMAGE", "DOCUMENT", "VIDEO"]);
export const chatbotHttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH"]);

export const createChatbotSchema = z.object({
  description: z.string().trim().max(1024).optional().nullable(),
  keywords: z.string().trim().max(500).optional().nullable(),
  name: z.string().trim().min(2).max(120),
});

export const createChatbotNodeSchema = z
  .object({
    aiFallback: z.string().trim().max(1024).optional().nullable(),
    aiPrompt: z.string().trim().max(4000).optional().nullable(),
    apiBody: z.string().trim().max(4000).optional().nullable(),
    apiHeaders: z.string().trim().max(2000).optional().nullable(),
    apiMethod: chatbotHttpMethodSchema.default("POST"),
    apiUrl: z
      .string()
      .trim()
      .url("API URL must be a valid URL")
      .optional()
      .nullable(),
    assignTo: z.string().trim().max(120).optional().nullable(),
    body: z.string().trim().max(4096).optional().nullable(),
    buttons: z.string().trim().max(500).optional().nullable(),
    conditionOperator: z
      .enum(["equals", "contains", "exists", "not_equals"])
      .default("equals"),
    conditionValue: z.string().trim().max(200).optional().nullable(),
    fallbackMessage: z.string().trim().max(1024).optional().nullable(),
    footer: z.string().trim().max(60).optional().nullable(),
    header: z.string().trim().max(60).optional().nullable(),
    listRows: z.string().trim().max(2000).optional().nullable(),
    mediaId: z.string().trim().max(200).optional().nullable(),
    mediaName: z.string().trim().max(255).optional().nullable(),
    mediaType: chatbotMediaTypeSchema.optional().nullable(),
    mediaUrl: z
      .string()
      .trim()
      .url("Media URL must be a valid public URL")
      .optional()
      .nullable(),
    name: z.string().trim().min(2).max(80),
    paymentAmount: z.string().trim().max(40).optional().nullable(),
    paymentDescription: z.string().trim().max(500).optional().nullable(),
    paymentLinkUrl: z
      .string()
      .trim()
      .url("Payment link must be a valid URL")
      .optional()
      .nullable(),
    primaryButton: z.string().trim().max(20).optional().nullable(),
    productDescription: z.string().trim().max(500).optional().nullable(),
    productImageUrl: z
      .string()
      .trim()
      .url("Product image URL must be valid")
      .optional()
      .nullable(),
    productRetailerId: z.string().trim().max(120).optional().nullable(),
    productTitle: z.string().trim().max(120).optional().nullable(),
    productUrl: z
      .string()
      .trim()
      .url("Product URL must be valid")
      .optional()
      .nullable(),
    questionField: z
      .string()
      .trim()
      .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, {
        message: "Use a variable name like customer_name",
      })
      .max(60)
      .optional()
      .nullable(),
    responseField: z
      .string()
      .trim()
      .regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, {
        message: "Use a variable name like api_result",
      })
      .max(60)
      .optional()
      .nullable(),
    sheetPayload: z.string().trim().max(4000).optional().nullable(),
    sheetWebhookUrl: z
      .string()
      .trim()
      .url("Google Sheet webhook URL must be valid")
      .optional()
      .nullable(),
    successMessage: z.string().trim().max(1024).optional().nullable(),
    tallyEndpointUrl: z
      .string()
      .trim()
      .url("Tally endpoint URL must be valid")
      .optional()
      .nullable(),
    tallySearchField: z.string().trim().max(80).optional().nullable(),
    webhookSecret: z.string().trim().max(200).optional().nullable(),
    webhookUrl: z
      .string()
      .trim()
      .url("Webhook URL must be valid")
      .optional()
      .nullable(),
    type: simpleChatbotNodeTypeSchema,
  })
  .superRefine((input, context) => {
    const body = input.body?.trim() ?? "";

    if (
      ["MESSAGE", "QUICK_REPLY", "LIST_MENU", "MEDIA_BUTTONS", "QUESTION"].includes(
        input.type,
      ) &&
      !body
    ) {
      context.addIssue({
        code: "custom",
        path: ["body"],
        message: "Message text is required for this node",
      });
    }

    if (input.type === "QUICK_REPLY" || input.type === "MEDIA_BUTTONS") {
      const hasButton = Boolean(input.buttons?.split(",").some((item) => item.trim()));

      if (!hasButton) {
        context.addIssue({
          code: "custom",
          path: ["buttons"],
          message: "Add at least one button",
        });
      }
    }

    if (
      input.type === "MEDIA_BUTTONS" &&
      (!input.mediaType || (!input.mediaUrl?.trim() && !input.mediaId?.trim()))
    ) {
      context.addIssue({
        code: "custom",
        path: ["mediaUrl"],
        message: "Media type and media URL or Meta media ID are required",
      });
    }

    if (
      input.type === "LIST_MENU" &&
      (!input.primaryButton?.trim() || !input.listRows?.trim())
    ) {
      context.addIssue({
        code: "custom",
        path: ["listRows"],
        message: "List button text and at least one row are required",
      });
    }

    if (
      ["API_CALL", "WEBHOOK"].includes(input.type) &&
      !input.apiUrl?.trim() &&
      !input.webhookUrl?.trim()
    ) {
      context.addIssue({
        code: "custom",
        path: ["apiUrl"],
        message: "Endpoint URL is required",
      });
    }

    if (input.type === "GOOGLE_SHEET_SAVE" && !input.sheetWebhookUrl?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["sheetWebhookUrl"],
        message: "Google Sheet webhook URL is required",
      });
    }

    if (
      ["TALLY_INVOICE_LOOKUP", "TALLY_LEDGER_BALANCE"].includes(input.type) &&
      !input.tallyEndpointUrl?.trim()
    ) {
      context.addIssue({
        code: "custom",
        path: ["tallyEndpointUrl"],
        message: "Tally endpoint URL is required",
      });
    }

    if (input.type === "CATALOG_PRODUCT_CARD" && !input.productTitle?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["productTitle"],
        message: "Product title is required",
      });
    }

    if (input.type === "PAYMENT_LINK" && !input.paymentLinkUrl?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["paymentLinkUrl"],
        message: "Payment link URL is required",
      });
    }

    if (input.type === "AI_REPLY" && !input.aiPrompt?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["aiPrompt"],
        message: "AI prompt is required",
      });
    }
  });

export const createChatbotEdgeSchema = z.object({
  label: z.string().trim().max(80).optional().nullable(),
  sourceNodeId: z.string().trim().min(1),
  targetNodeId: z.string().trim().min(1),
});

export const updateChatbotStatusSchema = z.object({
  status: chatbotStatusSchema,
});

export const createChatbotTriggerSchema = z
  .object({
    priority: z.coerce.number().int().min(1).max(999).default(100),
    type: chatbotTriggerTypeSchema,
    value: z.string().trim().max(240).optional().nullable(),
  })
  .superRefine((input, context) => {
    if (
      ["KEYWORD", "REGEX", "TEMPLATE_MESSAGE", "CLICK_TO_WHATSAPP_AD"].includes(
        input.type,
      ) &&
      !input.value?.trim()
    ) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "A trigger value is required",
      });
    }
  });

export const updateChatbotFallbackSchema = z.object({
  fallbackMessage: z.string().trim().max(1024).optional().nullable(),
});

const phoneDigits = (value: string) => value.replace(/\D/g, "");

export const startChatbotWhatsAppTestSchema = z.object({
  countryCode: z
    .string()
    .trim()
    .refine((value) => {
      const digits = phoneDigits(value);
      return digits.length >= 1 && digits.length <= 4;
    }, "Country code must contain 1 to 4 digits"),
  name: z.string().trim().max(100).optional().nullable(),
  phoneNumber: z
    .string()
    .trim()
    .refine(
      (value) => phoneDigits(value).length >= 8,
      "Phone number must contain at least 8 digits",
    ),
  testMessage: z.string().trim().max(240).optional().nullable(),
});

export type CreateChatbotInput = z.infer<typeof createChatbotSchema>;
export type CreateChatbotNodeInput = z.infer<
  typeof createChatbotNodeSchema
>;
export type CreateChatbotEdgeInput = z.infer<
  typeof createChatbotEdgeSchema
>;
export type CreateChatbotTriggerInput = z.infer<
  typeof createChatbotTriggerSchema
>;
export type UpdateChatbotFallbackInput = z.infer<
  typeof updateChatbotFallbackSchema
>;
export type UpdateChatbotStatusInput = z.infer<
  typeof updateChatbotStatusSchema
>;
export type StartChatbotWhatsAppTestInput = z.infer<
  typeof startChatbotWhatsAppTestSchema
>;
