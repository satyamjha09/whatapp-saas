import type { PlatformRole } from "@/generated/prisma/client";

export const PLATFORM_PERMISSIONS = [
  "PLATFORM_OVERVIEW_VIEW",
  "PLATFORM_COMPANY_VIEW",
  "PLATFORM_COMPANY_MANAGE",
  "PLATFORM_PARTNER_VIEW",
  "PLATFORM_PARTNER_MANAGE",
  "PLATFORM_USER_MANAGE",
  "PLATFORM_PLAN_MANAGE",
  "PLATFORM_BILLING_VIEW",
  "PLATFORM_BILLING_MANAGE",
  "PLATFORM_USAGE_VIEW",
  "PLATFORM_BRANDING_MANAGE",
  "PLATFORM_REFUND_APPROVE",
  "PLATFORM_COMMISSION_MANAGE",
  "PLATFORM_PAYOUT_APPROVE",
  "PLATFORM_DOMAIN_APPROVE",
  "PLATFORM_SUPPORT_VIEW",
  "PLATFORM_SUPPORT_ACCESS",
  "PLATFORM_AUDIT_VIEW",
  "PLATFORM_SECURITY_VIEW",
  "PLATFORM_SETTINGS_MANAGE",
] as const;

export type PlatformPermission = (typeof PLATFORM_PERMISSIONS)[number];

const SUPPORT_PERMISSIONS = [
  "PLATFORM_OVERVIEW_VIEW",
  "PLATFORM_COMPANY_VIEW",
  "PLATFORM_PARTNER_VIEW",
  "PLATFORM_SUPPORT_VIEW",
  "PLATFORM_AUDIT_VIEW",
] as const satisfies readonly PlatformPermission[];

const FINANCE_PERMISSIONS = [
  "PLATFORM_OVERVIEW_VIEW",
  "PLATFORM_BILLING_VIEW",
  "PLATFORM_USAGE_VIEW",
  "PLATFORM_REFUND_APPROVE",
  "PLATFORM_COMMISSION_MANAGE",
  "PLATFORM_AUDIT_VIEW",
] as const satisfies readonly PlatformPermission[];

const ADMIN_PERMISSIONS = [
  "PLATFORM_OVERVIEW_VIEW",
  "PLATFORM_COMPANY_VIEW",
  "PLATFORM_COMPANY_MANAGE",
  "PLATFORM_PARTNER_VIEW",
  "PLATFORM_PARTNER_MANAGE",
  "PLATFORM_PLAN_MANAGE",
  "PLATFORM_BILLING_VIEW",
  "PLATFORM_USAGE_VIEW",
  "PLATFORM_BRANDING_MANAGE",
  "PLATFORM_DOMAIN_APPROVE",
  "PLATFORM_SUPPORT_VIEW",
  "PLATFORM_SUPPORT_ACCESS",
  "PLATFORM_AUDIT_VIEW",
  "PLATFORM_SECURITY_VIEW",
] as const satisfies readonly PlatformPermission[];

export const PLATFORM_ROLE_PERMISSIONS: Record<
  PlatformRole,
  readonly PlatformPermission[]
> = {
  NONE: [],
  SUPPORT: SUPPORT_PERMISSIONS,
  FINANCE: FINANCE_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
  SUPER_ADMIN: PLATFORM_PERMISSIONS,
};

export function getPlatformPermissionsForRole(role: PlatformRole) {
  return PLATFORM_ROLE_PERMISSIONS[role] ?? [];
}

export function roleHasPlatformPermission(
  role: PlatformRole,
  permission: PlatformPermission,
) {
  return getPlatformPermissionsForRole(role).includes(permission);
}

export function roleHasAnyPlatformPermission(
  role: PlatformRole,
  permissions: readonly PlatformPermission[],
) {
  return permissions.some((permission) =>
    roleHasPlatformPermission(role, permission),
  );
}

export function isPlatformBootstrapEnabled() {
  return process.env.PLATFORM_ADMIN_BOOTSTRAP_ENABLED === "true";
}
