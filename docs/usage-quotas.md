# Usage Quotas

Usage Quotas enforce numeric limits on top of plan feature entitlements.

## Environment

```env
USAGE_QUOTAS_ENABLED="true"
USAGE_QUOTAS_STRICT_MODE="true"
USAGE_QUOTAS_LOG_ALLOWED="false"

USAGE_QUOTAS_MESSAGE_PERIOD="MONTHLY"
USAGE_QUOTAS_CONTACT_PERIOD="LIFETIME"
USAGE_QUOTAS_TEMPLATE_PERIOD="LIFETIME"
USAGE_QUOTAS_CAMPAIGN_PERIOD="MONTHLY"
USAGE_QUOTAS_COMPLIANCE_EXPORT_PERIOD="MONTHLY"
```

## Sync Counters

```bash
npm run quotas:sync
```

## Dashboard

```text
/dashboard/billing/usage-quotas
```

## Enforce Before Create

```ts
await assertUsageQuotaAvailable({
  companyId,
  featureKey: "CONTACTS",
  amount: 1,
});
```

## Increment After Create

```ts
await incrementUsageQuota({
  companyId,
  featureKey: "CONTACTS",
  amount: 1,
  idempotencyKey: `contact-created:${contact.id}`,
});
```

## Recommended Quota Mappings

```text
CONTACTS            contact create/import
TEMPLATES           template sync/create
CAMPAIGNS           campaign create
BULK_MESSAGING      message send / bulk recipients
COMPLIANCE_EXPORTS  evidence export create
TEAM                team invite/accept
```

## Safety

Always check quota before creating records.
Always increment quota after successful create.
Use idempotency keys.
Run `npm run quotas:sync` after migration or manual DB edits.
