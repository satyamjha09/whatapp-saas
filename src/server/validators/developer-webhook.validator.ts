import { z } from "zod";

export const createDeveloperWebhookEndpointSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Webhook name must be at least 2 characters")
    .max(100, "Webhook name must be less than 100 characters"),

  url: z
    .string()
    .trim()
    .url("Enter a valid webhook URL")
    .refine(
      (url) =>
        url.startsWith("https://") ||
        url.startsWith("http://localhost") ||
        url.includes("ngrok"),
      "Webhook URL must be HTTPS in production",
    ),
});

export type CreateDeveloperWebhookEndpointInput = z.infer<
  typeof createDeveloperWebhookEndpointSchema
>;
