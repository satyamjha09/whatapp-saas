export const PLATFORM_ROLE_LEVEL = {
  NONE: 0,
  SUPPORT: 10,
  FINANCE: 20,
  ADMIN: 80,
  SUPER_ADMIN: 100,
} as const;

export const COMPANY_ROLE_LEVEL = {
  MEMBER: 10,
  ADMIN: 80,
  OWNER: 100,
} as const;

export function canAccessPlatform(role: keyof typeof PLATFORM_ROLE_LEVEL) {
  return PLATFORM_ROLE_LEVEL[role] > 0;
}

export function isPlatformAdmin(role: keyof typeof PLATFORM_ROLE_LEVEL) {
  return PLATFORM_ROLE_LEVEL[role] >= PLATFORM_ROLE_LEVEL.ADMIN;
}

export function isPlatformSuperAdmin(role: keyof typeof PLATFORM_ROLE_LEVEL) {
  return role === "SUPER_ADMIN";
}

export function isCompanyAdmin(role: keyof typeof COMPANY_ROLE_LEVEL) {
  return COMPANY_ROLE_LEVEL[role] >= COMPANY_ROLE_LEVEL.ADMIN;
}

export function isCompanyOwner(role: keyof typeof COMPANY_ROLE_LEVEL) {
  return role === "OWNER";
}
