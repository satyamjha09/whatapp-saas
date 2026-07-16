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
  | "wallet.credit_deducted"
  | "partner.client.provisioning_started"
  | "partner.client.provisioned"
  | "partner.client.provisioning_failed"
  | "partner.client.suspended"
  | "partner.client.reactivated"
  | "partner.subscription.activated"
  | "partner.subscription.expiring"
  | "partner.usage.limit_reached"
  | "partner.invoice.created"
  | "partner.invoice.paid"
  | "partner.commission.created"
  | "partner.commission.available"
  | "partner.payout.paid";

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
  {
    id: "partner.client.provisioning_started",
    label: "Partner Client Provisioning Started",
    description: "Triggered when a partner client workspace provisioning job starts.",
  },
  {
    id: "partner.client.provisioned",
    label: "Partner Client Provisioned",
    description: "Triggered when a partner client workspace is ready.",
  },
  {
    id: "partner.client.provisioning_failed",
    label: "Partner Client Provisioning Failed",
    description: "Triggered when client provisioning cannot complete.",
  },
  {
    id: "partner.client.suspended",
    label: "Partner Client Suspended",
    description: "Triggered when a partner-owned client is suspended.",
  },
  {
    id: "partner.client.reactivated",
    label: "Partner Client Reactivated",
    description: "Triggered when a suspended partner-owned client is reactivated.",
  },
  {
    id: "partner.subscription.activated",
    label: "Partner Subscription Activated",
    description: "Triggered when a partner client subscription becomes active.",
  },
  {
    id: "partner.subscription.expiring",
    label: "Partner Subscription Expiring",
    description: "Triggered when a partner client subscription is near expiry.",
  },
  {
    id: "partner.usage.limit_reached",
    label: "Partner Usage Limit Reached",
    description: "Triggered when a partner client reaches a usage limit.",
  },
  {
    id: "partner.invoice.created",
    label: "Partner Invoice Created",
    description: "Triggered when a partner invoice is created.",
  },
  {
    id: "partner.invoice.paid",
    label: "Partner Invoice Paid",
    description: "Triggered when a partner invoice is paid.",
  },
  {
    id: "partner.commission.created",
    label: "Partner Commission Created",
    description: "Triggered when a partner commission accrual is created.",
  },
  {
    id: "partner.commission.available",
    label: "Partner Commission Available",
    description: "Triggered when a partner commission becomes payable.",
  },
  {
    id: "partner.payout.paid",
    label: "Partner Payout Paid",
    description: "Triggered when a partner payout is marked paid.",
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
