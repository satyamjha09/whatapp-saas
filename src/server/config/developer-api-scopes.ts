export type DeveloperApiScope =
  | "MESSAGES_READ"
  | "MESSAGES_WRITE"
  | "CONTACTS_READ"
  | "CONTACTS_WRITE"
  | "TEMPLATES_READ"
  | "CAMPAIGNS_READ"
  | "WEBHOOKS_READ"
  | "WEBHOOKS_WRITE";

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
