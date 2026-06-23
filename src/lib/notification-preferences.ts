export const NOTIFICATION_TYPE_OPTIONS = [
  {
    type: "BILLING",
    label: "Billing",
    description: "Subscription expiry, payment failures, plan changes.",
  },
  {
    type: "WALLET",
    label: "Wallet",
    description: "Low balance, credit additions, failed deductions.",
  },
  {
    type: "WEBHOOK",
    label: "Webhooks",
    description: "Webhook failures, auto-disable, outbox issues.",
  },
  {
    type: "DEVELOPER_API",
    label: "Developer API",
    description: "API key, rate limit, and developer tool alerts.",
  },
  {
    type: "CAMPAIGN",
    label: "Campaigns",
    description: "Campaign completion, failures, and delivery issues.",
  },
  {
    type: "SYSTEM",
    label: "System",
    description: "Maintenance, background jobs, and operational alerts.",
  },
] as const;

export const NOTIFICATION_SEVERITY_OPTIONS = [
  { severity: "INFO", label: "Info and above" },
  { severity: "SUCCESS", label: "Success and above" },
  { severity: "WARNING", label: "Warning and above" },
  { severity: "ERROR", label: "Errors only" },
] as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPE_OPTIONS)[number]["type"];
export type NotificationSeverity =
  (typeof NOTIFICATION_SEVERITY_OPTIONS)[number]["severity"];
