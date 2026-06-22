export type DeveloperWebhookEvent =
  | "message.sent"
  | "message.delivered"
  | "message.read"
  | "message.failed"
  | "message.received"
  | "contact.created"
  | "contact.updated"
  | "campaign.created"
  | "campaign.completed"
  | "wallet.credit_added"
  | "wallet.credit_deducted";

export const DEVELOPER_WEBHOOK_EVENTS: {
  id: DeveloperWebhookEvent;
  label: string;
  description: string;
}[] = [
  {
    id: "message.sent",
    label: "Message Sent",
    description: "Triggered when an outbound message is accepted for sending.",
  },
  {
    id: "message.delivered",
    label: "Message Delivered",
    description: "Triggered when WhatsApp marks a message as delivered.",
  },
  {
    id: "message.read",
    label: "Message Read",
    description: "Triggered when WhatsApp marks a message as read.",
  },
  {
    id: "message.failed",
    label: "Message Failed",
    description: "Triggered when an outbound message fails.",
  },
  {
    id: "message.received",
    label: "Message Received",
    description: "Triggered when an inbound WhatsApp message is received.",
  },
  {
    id: "contact.created",
    label: "Contact Created",
    description: "Triggered when a new contact is created.",
  },
  {
    id: "contact.updated",
    label: "Contact Updated",
    description: "Triggered when a contact is updated.",
  },
  {
    id: "campaign.created",
    label: "Campaign Created",
    description: "Triggered when a campaign/bulk batch is created.",
  },
  {
    id: "campaign.completed",
    label: "Campaign Completed",
    description: "Triggered when a campaign finishes processing.",
  },
  {
    id: "wallet.credit_added",
    label: "Wallet Credit Added",
    description: "Triggered when credits are added to the wallet.",
  },
  {
    id: "wallet.credit_deducted",
    label: "Wallet Credit Deducted",
    description: "Triggered when credits are deducted for sends.",
  },
];

export const DEFAULT_DEVELOPER_WEBHOOK_EVENTS: DeveloperWebhookEvent[] = [
  "message.sent",
  "message.delivered",
  "message.read",
  "message.failed",
  "message.received",
];

export const DEVELOPER_WEBHOOK_PAYLOAD_VERSION = "2026-06-01";

export function isDeveloperWebhookEvent(
  value: string,
): value is DeveloperWebhookEvent {
  return DEVELOPER_WEBHOOK_EVENTS.some((event) => event.id === value);
}
