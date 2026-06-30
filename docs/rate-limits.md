# Global Rate Limits

TallyKonnect uses Redis-backed IP rate limits for sensitive endpoints.

## Protected areas

- WhatsApp webhook POST
- Cashfree order creation
- subscription order creation
- campaign preflight
- bulk message creation
- contact import
- developer webhook retry actions
- developer/public API routes

## Behavior

When a client exceeds the limit, the API returns:

```txt
429 Too Many Requests
```

Response:

```json
{
  "message": "Too many requests. Please try again later.",
  "retryAfterSeconds": 60
}
```

The response includes:

- `Retry-After` header with seconds to wait before retrying.

## Configuration

Rate limit rules are stored in:

`src/server/config/rate-limits.ts`

## Production notes

These limits require Redis.

If Redis is down, the protected route may fail. That is intentional for sensitive write endpoints because accepting unlimited traffic during Redis failure is unsafe.
