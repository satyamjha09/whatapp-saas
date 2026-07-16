import assert from "node:assert/strict";
import {
  getPlatformPermissionsForRole,
  isPlatformBootstrapEnabled,
  roleHasPlatformPermission,
} from "@/server/tenant/platform-permissions";

function withEnv<T>(key: string, value: string | undefined, run: () => T) {
  const previous = process.env[key];

  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }

  try {
    return run();
  } finally {
    if (previous === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  }
}

assert.equal(
  roleHasPlatformPermission("SUPPORT", "PLATFORM_COMPANY_VIEW"),
  true,
  "Support can view companies.",
);
assert.equal(
  roleHasPlatformPermission("SUPPORT", "PLATFORM_PLAN_MANAGE"),
  false,
  "Support cannot manage plans.",
);
assert.equal(
  roleHasPlatformPermission("FINANCE", "PLATFORM_BILLING_VIEW"),
  true,
  "Finance can view billing.",
);
assert.equal(
  roleHasPlatformPermission("FINANCE", "PLATFORM_COMPANY_MANAGE"),
  false,
  "Finance cannot manage companies.",
);
assert.equal(
  roleHasPlatformPermission("ADMIN", "PLATFORM_COMPANY_MANAGE"),
  true,
  "Admin can manage companies.",
);
assert.equal(
  roleHasPlatformPermission("ADMIN", "PLATFORM_USER_MANAGE"),
  false,
  "Admin cannot manage platform users.",
);
assert.equal(
  roleHasPlatformPermission("SUPER_ADMIN", "PLATFORM_SETTINGS_MANAGE"),
  true,
  "Super Admin has platform settings permission.",
);
assert.equal(
  getPlatformPermissionsForRole("NONE").length,
  0,
  "No platform role has no permissions.",
);

withEnv("PLATFORM_ADMIN_BOOTSTRAP_ENABLED", undefined, () => {
  assert.equal(isPlatformBootstrapEnabled(), false);
});
withEnv("PLATFORM_ADMIN_BOOTSTRAP_ENABLED", "false", () => {
  assert.equal(isPlatformBootstrapEnabled(), false);
});
withEnv("PLATFORM_ADMIN_BOOTSTRAP_ENABLED", "true", () => {
  assert.equal(isPlatformBootstrapEnabled(), true);
});

console.log("Platform permission mapping checks passed.");
