import { z } from "zod";
import {
  DEVELOPER_WEBHOOK_EVENTS,
  DEVELOPER_WEBHOOK_PAYLOAD_VERSION,
} from "@/server/config/developer-webhook-events";

const webhookEventIds = DEVELOPER_WEBHOOK_EVENTS.map((event) => event.id) as [
  string,
  ...string[],
];

export const developerWebhookSchema = z.object({
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
  events: z.array(z.enum(webhookEventIds)).min(1, "Select at least one event"),
  payloadVersion: z
    .string()
    .trim()
    .min(1, "Payload version is required")
    .default(DEVELOPER_WEBHOOK_PAYLOAD_VERSION),
});

export const createDeveloperWebhookEndpointSchema = developerWebhookSchema;

export type CreateDeveloperWebhookEndpointInput = z.infer<
  typeof createDeveloperWebhookEndpointSchema
>;
