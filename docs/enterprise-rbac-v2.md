# Enterprise RBAC v2

Enterprise RBAC adds company-scoped custom roles, granular permissions, and one active access-role assignment per team member. It uses `CompanyAccessRole` so it does not conflict with the legacy `CompanyRole` enum.

## Environment

```env
RBAC_V2_ENABLED="true"
RBAC_V2_STRICT_MODE="true"
RBAC_V2_DEFAULT_MEMBER_ROLE="member"
```

These are also the defaults when the variables are omitted.

## Bootstrap

Run `npm run rbac:seed` after applying the migration. It creates the protected `owner`, `admin`, `manager`, `member`, and `readonly` system roles for every company and maps existing legacy OWNER, ADMIN, and MEMBER memberships to their corresponding access roles.

New company owners and users accepting invitations receive an access-role assignment automatically.

## Dashboard and API

Manage assignments and inspect the permission matrix at `/dashboard/team/roles`. Role creation and assignment APIs require `TEAM_MANAGE_ROLES`, validate tenant membership, and create audit-log evidence.

In strict mode, users without an active assignment receive no RBAC permissions. Disabling RBAC grants all RBAC permissions while preserving the existing authentication and legacy role checks.
