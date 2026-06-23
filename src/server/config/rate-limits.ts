export type RateLimitRule = {
  id: string;
  windowSeconds: number;
  maxRequests: number;
};

export const RATE_LIMIT_RULES = {
  whatsappWebhook: {
    id: "whatsapp-webhook",
    windowSeconds: 60,
    maxRequests: 600,
  },

  billingOrderCreate: {
    id: "billing-order-create",
    windowSeconds: 60,
    maxRequests: 20,
  },

  subscriptionOrderCreate: {
    id: "subscription-order-create",
    windowSeconds: 60,
    maxRequests: 20,
  },

  campaignPreflight: {
    id: "campaign-preflight",
    windowSeconds: 60,
    maxRequests: 60,
  },

  bulkMessageCreate: {
    id: "bulk-message-create",
    windowSeconds: 60,
    maxRequests: 30,
  },

  contactImport: {
    id: "contact-import",
    windowSeconds: 60,
    maxRequests: 20,
  },

  developerApi: {
    id: "developer-api",
    windowSeconds: 60,
    maxRequests: 300,
  },

  developerWebhookRetry: {
    id: "developer-webhook-retry",
    windowSeconds: 60,
    maxRequests: 30,
  },
} satisfies Record<string, RateLimitRule>;
