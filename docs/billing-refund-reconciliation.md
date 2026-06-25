# Billing Refund Reconciliation

Refund reconciliation syncs local refund status with Razorpay refund webhooks and scheduled polling.

## Environment

```env
BILLING_REFUND_RECONCILIATION_ENABLED="true"
BILLING_REFUND_RECONCILIATION_SCAN_CRON="*/30 * * * *"
BILLING_REFUND_MAX_RECONCILIATION_ATTEMPTS="8"
BILLING_REFUND_STALE_PROCESSING_HOURS="24"
BILLING_REFUND_NOTIFY_FAILED="true"
```

## Webhook events
Handled events:
```txt
refund.created
refund.processed
refund.failed
```

## Dashboard
`/dashboard/billing/refunds`

## Flow
1. Admin creates refund.
2. Refund is marked PROCESSING or PROCESSED based on Razorpay response.
3. Razorpay webhook updates local refund status.
4. Scheduled worker reconciles pending refunds.
5. Failed refund voids credit note and notifies billing admins.
6. System Health shows stale or failed refund states.

## Safety
- Refund status updates are idempotent.
- Failed refunds void related credit note.
- Stale processing refunds appear in System Health.
- Webhook processing uses existing Razorpay raw-body verification.
