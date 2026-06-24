# Feature Entitlements

Feature Entitlements enforce SaaS plan access for Free, Starter, Growth, and Business companies, with temporary company-specific overrides.

## Environment

```env
FEATURE_ENTITLEMENTS_ENABLED="true"
FEATURE_ENTITLEMENTS_STRICT_MODE="true"
FEATURE_ENTITLEMENTS_BLOCK_PAST_DUE="true"
FEATURE_ENTITLEMENTS_LOG_ALLOWED="false"
FEATURE_ENTITLEMENTS_FREE_MONTHLY_MESSAGES="100"
FEATURE_ENTITLEMENTS_STARTER_MONTHLY_MESSAGES="1000"
FEATURE_ENTITLEMENTS_GROWTH_MONTHLY_MESSAGES="10000"
FEATURE_ENTITLEMENTS_BUSINESS_MONTHLY_MESSAGES="50000"
```

Run `npm run entitlements:seed` after applying the migration. The dashboard is `/dashboard/system/entitlements`.

## Enforcement

Route mappings live in `src/server/auth/feature-route-entitlements.ts`. Registered admin routes inherit entitlement enforcement through the shared permission guard. Other handlers can call:

```ts
await assertRouteFeatureEntitlement({ request, workspace });
```

Blocked checks are logged with company, plan, feature, route, method, and reason. Allowed checks are logged only when `FEATURE_ENTITLEMENTS_LOG_ALLOWED=true`.

Past-due, canceled, and incomplete subscriptions are blocked from gated features. Billing recovery, public privacy requests, provider webhooks, and required legal acceptance remain outside paid-plan gates.

## Overrides

Overrides can enable, disable, or change a limit temporarily. Creation is restricted to configured platform admins so tenant users cannot self-upgrade; tenant admins can view overrides for their own company.
