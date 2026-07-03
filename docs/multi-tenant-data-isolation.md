# Multi-tenant Data Isolation

metawhat uses a tenant guard to prevent one company from accessing another company's resources.

## Rule

Every company-owned query must include:

```ts
companyId: context.membership.companyId
```

For nested resources, verify through the parent relation.

## Guard

Use:

```ts
await assertTenantEntityAccess({
  request,
  companyId: context.membership.companyId,
  entityType: "Contact",
  entityId: contactId,
});
```

## Why 404?

Tenant guard returns:

```txt
404 Resource not found
```

not 403, because we should not reveal that another company's resource exists.

## Audit dynamic routes

Run:

```bash
npm run audit:tenant-routes
```

Review any route marked with warning.

## Environment

```env
TENANT_GUARD_ENABLED="true"
```
