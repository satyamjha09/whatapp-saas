# Webhook Signature Security

TallyKonnect verifies provider webhook signatures before processing webhook payloads.

## Providers

- Meta WhatsApp webhook: `x-hub-signature-256`
- Razorpay webhook: `x-razorpay-signature`

## Environment

```env
WEBHOOK_SIGNATURE_VERIFICATION_ENABLED="true"

META_APP_SECRET=""
RAZORPAY_WEBHOOK_SECRET=""

WEBHOOK_REPLAY_GUARD_MODE="log"
WEBHOOK_REPLAY_TTL_SECONDS="86400"
```

## Replay mode

Start with:

```env
WEBHOOK_REPLAY_GUARD_MODE="log"
```

This detects duplicate webhook delivery but does not block provider retries.

Only switch to:

```env
WEBHOOK_REPLAY_GUARD_MODE="block"
```

after confirming your webhook handlers are fully idempotent and provider retries are safe to reject.

## Signature failures

Invalid signatures return:

```txt
401 Invalid webhook signature
```

They are also recorded as:

```txt
SecurityEvent WEBHOOK_SIGNATURE_FAILURE
```

View them in:

```txt
/dashboard/system/health
```

## Important

Webhook signature verification must use the raw request body.

Do not call:

```ts
await request.json();
```

before verifying the signature.
