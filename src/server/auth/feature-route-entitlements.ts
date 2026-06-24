import { FeatureEntitlementKey } from "@/generated/prisma/client";

export type FeatureRouteRule = {
  id: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "*";
  pattern: RegExp;
  featureKey: FeatureEntitlementKey;
};

export const FEATURE_ROUTE_RULES: FeatureRouteRule[] = [
  { id: "campaigns", method: "*", pattern: /^\/api\/campaigns(?:\/|$)/, featureKey: "CAMPAIGNS" },
  { id: "bulk-messaging", method: "*", pattern: /^\/api\/(?:bulk-messages|messages\/bulk-template)(?:\/|$)/, featureKey: "BULK_MESSAGING" },
  { id: "developer-api-keys", method: "*", pattern: /^\/api\/developer\/api-keys(?:\/|$)/, featureKey: "DEVELOPER_API" },
  { id: "developer-webhooks", method: "*", pattern: /^\/api\/developer\/webhooks(?:\/|$)/, featureKey: "DEVELOPER_WEBHOOKS" },
  { id: "privacy-center", method: "*", pattern: /^\/api\/privacy\/requests(?:\/|$)/, featureKey: "PRIVACY_CENTER" },
  { id: "consent-center", method: "*", pattern: /^\/api\/(?:consent|contacts\/[^/]+\/consent)(?:\/|$)/, featureKey: "CONSENT_CENTER" },
  { id: "compliance-exports", method: "*", pattern: /^\/api\/system\/compliance(?:\/|$)/, featureKey: "COMPLIANCE_EXPORTS" },
  { id: "trust-center", method: "*", pattern: /^\/api\/trust\/documents(?:\/|$)/, featureKey: "TRUST_CENTER" },
  { id: "rbac", method: "*", pattern: /^\/api\/team\/(?:roles|role-assignments)(?:\/|$)/, featureKey: "RBAC" },
  { id: "system-operations", method: "*", pattern: /^\/api\/system\/(?:data-retention|legal-holds|billing-reconciliation|dead-letter-queue|operation-lock)(?:\/|$)/, featureKey: "SYSTEM_OPERATIONS" },
];

export function getFeatureForRoute({ pathname, method }: { pathname: string; method: string }) {
  const upperMethod = method.toUpperCase();
  return FEATURE_ROUTE_RULES.find(
    (rule) => (rule.method === "*" || rule.method === upperMethod) && rule.pattern.test(pathname),
  );
}
