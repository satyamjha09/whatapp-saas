export type RegisteredQueue = {
  name: string;
  label: string;
  description: string;
};

export const REGISTERED_QUEUES: RegisteredQueue[] = [
  {
    name: "message-queue",
    label: "Message Worker",
    description: "Outbound WhatsApp message and bulk campaign delivery jobs",
  },
  {
    name: "webhook-queue",
    label: "Webhook Worker",
    description: "Inbound provider webhook processing jobs",
  },
  {
    name: "developer-webhook-queue",
    label: "Developer Webhook Worker",
    description: "Developer webhook delivery jobs",
  },
  {
    name: "developer-webhook-outbox",
    label: "Developer Webhook Outbox Worker",
    description: "Outbox recovery and delivery jobs",
  },
  {
    name: "maintenance-queue",
    label: "Maintenance Worker",
    description: "Scheduled cleanup, backup, retention, and recovery jobs",
  },
  {
    name: "notification-email",
    label: "Notification Email Worker",
    description: "Email notification delivery jobs",
  },
  {
    name: process.env.CAMPAIGN_LAUNCH_QUEUE_NAME || "campaign-launch",
    label: "Campaign Launch Worker",
    description: "Campaign launch planning and message row creation jobs",
  },
];

export function getRegisteredQueueNames() {
  return REGISTERED_QUEUES.map((queue) => queue.name);
}

export function getQueueLabel(queueName: string) {
  return (
    REGISTERED_QUEUES.find((queue) => queue.name === queueName)?.label ??
    queueName
  );
}
