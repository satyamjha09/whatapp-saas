import type { PlatformPermission } from "@/server/tenant/platform-permissions";

export type PlatformNavigationItem = {
  label: string;
  href: string;
  permission: PlatformPermission;
};

export const PLATFORM_NAVIGATION: PlatformNavigationItem[] = [
  {
    label: "Overview",
    href: "/platform/overview",
    permission: "PLATFORM_OVERVIEW_VIEW",
  },
  {
    label: "Companies",
    href: "/platform/companies",
    permission: "PLATFORM_COMPANY_VIEW",
  },
  {
    label: "Partners",
    href: "/platform/partners",
    permission: "PLATFORM_PARTNER_VIEW",
  },
  {
    label: "Platform Users",
    href: "/platform/users",
    permission: "PLATFORM_USER_MANAGE",
  },
  {
    label: "Plans",
    href: "/platform/plans",
    permission: "PLATFORM_PLAN_MANAGE",
  },
  {
    label: "Billing",
    href: "/platform/billing",
    permission: "PLATFORM_BILLING_VIEW",
  },
  {
    label: "Usage",
    href: "/platform/usage",
    permission: "PLATFORM_USAGE_VIEW",
  },
  {
    label: "Branding",
    href: "/platform/branding",
    permission: "PLATFORM_BRANDING_MANAGE",
  },
  {
    label: "Email",
    href: "/platform/email",
    permission: "PLATFORM_BRANDING_MANAGE",
  },
  {
    label: "Commissions",
    href: "/platform/commissions",
    permission: "PLATFORM_COMMISSION_MANAGE",
  },
  {
    label: "Payouts",
    href: "/platform/payouts",
    permission: "PLATFORM_PAYOUT_APPROVE",
  },
  {
    label: "Domains",
    href: "/platform/domains",
    permission: "PLATFORM_DOMAIN_APPROVE",
  },
  {
    label: "Support",
    href: "/platform/support",
    permission: "PLATFORM_SUPPORT_VIEW",
  },
  {
    label: "Audit Logs",
    href: "/platform/audit",
    permission: "PLATFORM_AUDIT_VIEW",
  },
  {
    label: "Security",
    href: "/platform/security",
    permission: "PLATFORM_SECURITY_VIEW",
  },
  {
    label: "Settings",
    href: "/platform/settings",
    permission: "PLATFORM_SETTINGS_MANAGE",
  },
];

