# RBAC Permission Registry and Guard Audit

This module prevents registered sensitive API operations from being created without permission checks.

## Environment

```env
RBAC_PERMISSION_AUDIT_ENABLED="true"
RBAC_PERMISSION_AUDIT_FAIL_ON_MISSING_GUARDS="true"
RBAC_PERMISSION_AUDIT_SENSITIVE_ONLY="true"
```

These are the defaults when omitted.

## Run the Audit

```sh
npm run rbac:audit
```

Each audit is persisted with route totals, guarded operations, missing registry warnings, missing guard errors, and per-route findings. Registered operations without a visible guard fail the command and CI.

## Registry and Guard

Permission rules live in `src/server/auth/rbac-route-permissions.ts`. Authenticated admin routes using `requireAdmin({ request })` inherit registry enforcement centrally. Legacy handlers use:

```ts
await assertRoutePermission({ request, workspace });
```

When adding a sensitive API, add its method/path rule, enforce `assertRoutePermission()` or `requireAdmin({ request })`, run the audit, and confirm `missingGuards` is zero.

Public provider webhooks and the required legal-acceptance endpoint are deliberately outside administrative RBAC enforcement.
