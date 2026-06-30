# Plan Upgrade Checkout

Self-serve plan upgrades let companies upgrade from Free, Starter, or Growth to paid plans.

## Environment

```env
PLAN_UPGRADES_ENABLED="true"
PLAN_UPGRADE_CURRENCY="INR"

PLAN_PRICE_STARTER_PAISE="99900"
PLAN_PRICE_GROWTH_PAISE="299900"
PLAN_PRICE_BUSINESS_PAISE="999900"

PLAN_LIMIT_STARTER_MESSAGES="1000"
PLAN_LIMIT_GROWTH_MESSAGES="10000"
PLAN_LIMIT_BUSINESS_MESSAGES="50000"

PLAN_UPGRADE_SUCCESS_REDIRECT="/dashboard/billing"
PLAN_UPGRADE_CANCEL_REDIRECT="/dashboard/billing/usage-quotas"
```

## Dashboard

```text
/dashboard/billing/upgrade
```

## Flow

User clicks Upgrade.
System creates a PlanCheckout.
Cashfree order is created.
User pays in Cashfree Checkout.
Frontend sends the Cashfree order ID to the verify API.
Payment state is verified server-side with Cashfree.
Company plan is updated.
Plan change ledger is created.
Audit log is created.

## Safety

Never trust frontend payment success alone.
Always verify Cashfree payment state server-side.
Store checkout and plan change history.
Update company plan only after verification.
