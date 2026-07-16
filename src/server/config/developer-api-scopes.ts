export type DeveloperApiScope =
  | "MESSAGES_READ"
  | "MESSAGES_WRITE"
  | "CONTACTS_READ"
  | "CONTACTS_WRITE"
  | "TEMPLATES_READ"
  | "CAMPAIGNS_READ"
  | "WEBHOOKS_READ"
  | "WEBHOOKS_WRITE"
  | "partner:clients:read"
  | "partner:clients:create"
  | "partner:clients:update"
  | "partner:clients:suspend"
  | "partner:subscriptions:read"
  | "partner:subscriptions:write"
  | "partner:usage:read"
  | "partner:invoices:read"
  | "partner:commissions:read"
  | "partner:payouts:read"
  | "partner:branding:read"
  | "partner:webhooks:manage";

export const DEVELOPER_API_SCOPES: {
  id: DeveloperApiScope;
  label: string;
  description: string;
}[] = [
  {
    id: "MESSAGES_READ",
    label: "Messages Read",
    description: "Read outbound and inbound message records.",
  },
  {
    id: "MESSAGES_WRITE",
    label: "Messages Write",
    description: "Send template messages through the public API.",
  },
  {
    id: "CONTACTS_READ",
    label: "Contacts Read",
    description: "Read contact records.",
  },
  {
    id: "CONTACTS_WRITE",
    label: "Contacts Write",
    description: "Create or update contacts.",
  },
  {
    id: "TEMPLATES_READ",
    label: "Templates Read",
    description: "Read approved WhatsApp templates.",
  },
  {
    id: "CAMPAIGNS_READ",
    label: "Campaigns Read",
    description: "Read campaign and delivery reports.",
  },
  {
    id: "WEBHOOKS_READ",
    label: "Webhooks Read",
    description: "Read developer webhook configuration and delivery logs.",
  },
  {
    id: "WEBHOOKS_WRITE",
    label: "Webhooks Write",
    description: "Create, update, test, or disable developer webhooks.",
  },
  {
    id: "partner:clients:read",
    label: "Partner Clients Read",
    description: "Read client workspaces owned by this partner.",
  },
  {
    id: "partner:clients:create",
    label: "Partner Clients Create",
    description: "Provision new client workspaces for this partner.",
  },
  {
    id: "partner:clients:update",
    label: "Partner Clients Update",
    description: "Update partner-owned client metadata.",
  },
  {
    id: "partner:clients:suspend",
    label: "Partner Clients Suspend",
    description: "Suspend or reactivate partner-owned client workspaces.",
  },
  {
    id: "partner:subscriptions:read",
    label: "Partner Subscriptions Read",
    description: "Read partner client subscriptions.",
  },
  {
    id: "partner:subscriptions:write",
    label: "Partner Subscriptions Write",
    description: "Manage partner client subscriptions.",
  },
  {
    id: "partner:usage:read",
    label: "Partner Usage Read",
    description: "Read partner client usage and limits.",
  },
  {
    id: "partner:invoices:read",
    label: "Partner Invoices Read",
    description: "Read partner invoices.",
  },
  {
    id: "partner:commissions:read",
    label: "Partner Commissions Read",
    description: "Read partner commission accruals.",
  },
  {
    id: "partner:payouts:read",
    label: "Partner Payouts Read",
    description: "Read partner payout records.",
  },
  {
    id: "partner:branding:read",
    label: "Partner Branding Read",
    description: "Read partner white-label branding status.",
  },
  {
    id: "partner:webhooks:manage",
    label: "Partner Webhooks Manage",
    description: "Manage partner webhook endpoints and delivery events.",
  },
];

export const DEFAULT_DEVELOPER_API_SCOPES: DeveloperApiScope[] = [
  "MESSAGES_READ",
  "MESSAGES_WRITE",
  "CONTACTS_READ",
  "CONTACTS_WRITE",
  "TEMPLATES_READ",
];

export function isDeveloperApiScope(value: string): value is DeveloperApiScope {
  return DEVELOPER_API_SCOPES.some((scope) => scope.id === value);
}
