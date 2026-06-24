# Plan Checkout Reconciliation

Plan Checkout Reconciliation makes plan upgrades resilient.

## Environment

```env
PLAN_CHECKOUT_RECONCILIATION_ENABLED="true"
PLAN_CHECKOUT_EXPIRY_MINUTES="60"
PLAN_CHECKOUT_RECONCILIATION_SCAN_CRON="*/20 * * * *"
PLAN_CHECKOUT_MAX_RECONCILIATION_ATTEMPTS="5"
```

## Why this exists

Frontend payment success is not enough. Users may close the browser after payment, network requests may fail, or checkout may be abandoned.

## Flow
1. User creates checkout.
2. Checkout receives an expiry timestamp.
3. Frontend verification can complete payment.
4. Razorpay webhook can also complete payment.
5. Scheduled reconciliation expires old unpaid checkouts.
6. Captured payments without signature create manual review notification.

## Safety
- Completion is idempotent.
- Paid checkouts are not double-applied.
- Expired checkout cannot update plan.
- Captured payment without trusted signature requires manual review.
