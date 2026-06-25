import { RbacPermission } from "@/generated/prisma/client";

export type RbacRoutePermissionRule = {
  id: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "*";
  pattern: RegExp;
  permission: RbacPermission;
  description: string;
};

export const RBAC_ROUTE_PERMISSION_RULES: RbacRoutePermissionRule[] = [
  { id: "campaign-create", method: "POST", pattern: /^\/api\/campaigns$/, permission: "CAMPAIGN_CREATE", description: "Create campaign" },
  { id: "campaign-send", method: "POST", pattern: /^\/api\/campaigns\/[^/]+\/(?:start|send)$/, permission: "CAMPAIGN_SEND", description: "Start campaign" },
  { id: "campaign-cancel", method: "POST", pattern: /^\/api\/campaigns\/[^/]+\/cancel$/, permission: "CAMPAIGN_CANCEL", description: "Cancel campaign" },
  { id: "contact-export", method: "GET", pattern: /^\/api\/contacts\/export$/, permission: "CONTACT_EXPORT", description: "Export contacts" },
  { id: "contact-delete", method: "DELETE", pattern: /^\/api\/contacts\/[^/]+$/, permission: "CONTACT_DELETE", description: "Delete contact" },
  { id: "whatsapp-settings-manage", method: "*", pattern: /^\/api\/whatsapp\/settings(?:\/|$)/, permission: "WHATSAPP_SETTINGS_MANAGE", description: "Manage WhatsApp settings" },
  { id: "api-key-manage", method: "*", pattern: /^\/api\/developer\/api-keys(?:\/|$)/, permission: "DEVELOPER_API_KEYS_MANAGE", description: "Manage developer API keys" },
  { id: "developer-webhooks-manage", method: "*", pattern: /^\/api\/developer\/webhooks(?:\/|$)/, permission: "DEVELOPER_WEBHOOKS_MANAGE", description: "Manage developer webhooks" },
  { id: "subscription-renewals-scan", method: "POST", pattern: /^\/api\/billing\/subscription-renewals\/scan$/, permission: "BILLING_MANAGE", description: "Run subscription renewal scan" },
  { id: "billing-analytics-snapshot", method: "POST", pattern: /^\/api\/billing\/analytics\/snapshot$/, permission: "BILLING_MANAGE", description: "Generate billing analytics snapshots" },
  { id: "scheduled-plan-change-manage", method: "POST", pattern: /^\/api\/billing\/scheduled-plan-change\/(?:cancel-at-period-end|downgrade|undo|scan)$/, permission: "BILLING_MANAGE", description: "Manage scheduled billing plan changes" },
  { id: "privacy-request-process", method: "POST", pattern: /^\/api\/privacy\/requests\/[^/]+\/process$/, permission: "PRIVACY_REQUEST_PROCESS", description: "Process privacy request" },
  { id: "privacy-export-download", method: "GET", pattern: /^\/api\/privacy\/requests\/[^/]+\/download$/, permission: "PRIVACY_REQUEST_PROCESS", description: "Download privacy export" },
  { id: "compliance-evidence", method: "*", pattern: /^\/api\/system\/compliance(?:\/|$)/, permission: "COMPLIANCE_MANAGE", description: "Compliance evidence operations" },
  { id: "system-operations", method: "*", pattern: /^\/api\/system\/(?:data-retention|legal-holds|billing-reconciliation|dead-letter-queue|operation-lock)(?:\/|$)/, permission: "SYSTEM_OPERATIONS_MANAGE", description: "System operation actions" },
  { id: "entitlement-overrides", method: "*", pattern: /^\/api\/system\/entitlements\/overrides$/, permission: "SYSTEM_OPERATIONS_MANAGE", description: "Feature entitlement overrides" },
  { id: "trust-center-manage", method: "*", pattern: /^\/api\/trust\/documents(?:\/|$)/, permission: "TRUST_CENTER_MANAGE", description: "Trust Center document management" },
  { id: "team-role-manage", method: "*", pattern: /^\/api\/team\/(?:roles|role-assignments)(?:\/|$)/, permission: "TEAM_MANAGE_ROLES", description: "Role and permission management" },
];

export function getRequiredPermissionForRoute({
  pathname,
  method,
}: {
  pathname: string;
  method: string;
}) {
  const upperMethod = method.toUpperCase();
  return RBAC_ROUTE_PERMISSION_RULES.find(
    (rule) =>
      (rule.method === "*" || rule.method === upperMethod) &&
      rule.pattern.test(pathname),
  );
}
