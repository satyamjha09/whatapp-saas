# Billing Analytics

Billing Analytics tracks SaaS revenue metrics.

## Environment

```env
BILLING_ANALYTICS_ENABLED="true"
BILLING_ANALYTICS_SNAPSHOT_CRON="45 6 * * *"
BILLING_ANALYTICS_CURRENCY="INR"
BILLING_ANALYTICS_DEFAULT_WINDOW_DAYS="30"
```

## Dashboard

`/dashboard/billing/analytics`

## Metrics

- Gross revenue
- Refunds
- Net revenue
- Paid invoice count
- Refund count
- MRR
- ARR
- Active companies
- Paid companies
- Free companies
- Past-due companies
- Plan distribution
- Failed checkouts
- Failed refunds

## Snapshot Periods

- `DAILY`
- `MONTHLY`

## Manual Snapshot

Click Generate Snapshot on the billing analytics page.

## Scheduled Snapshot

The maintenance worker runs using:

```env
BILLING_ANALYTICS_SNAPSHOT_CRON="45 6 * * *"
```
