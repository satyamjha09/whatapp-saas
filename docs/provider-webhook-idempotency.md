# Provider Webhook Idempotency

TallyKonnect stores Meta and Razorpay webhook events in a provider webhook ledger before processing.

## Why

Providers retry webhooks. Without idempotency, retries can create duplicate:

- inbound messages
- message status updates
- payment captures
- wallet credits
- subscription updates

## Event key

Meta uses message/status IDs when available, otherwise the raw body hash.

Razorpay uses `x-razorpay-event-id` when available, otherwise event/entity information.

## Statuses

- `PROCESSING`
- `SUCCEEDED`
- `FAILED`
- `SKIPPED_DUPLICATE`

## Duplicate behavior

If a duplicate webhook was already processed successfully, the route returns:

```json
{
  "ok": true,
  "duplicate": true
}
```

If the previous attempt failed, the next provider retry can reprocess it.

## Retention

- Successful webhook events: 30 days
- Failed webhook events: 180 days
