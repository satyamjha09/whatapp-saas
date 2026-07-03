# Public API v1

metawhat Public API v1 is the stable customer-facing API at `/api/v1`.

## Authentication

```http
Authorization: Bearer <api_key>
```

The legacy `x-api-key` header remains supported.

## Idempotency

All mutations require:

```http
Idempotency-Key: unique-request-key
```

- same key and payload: the stored response is replayed;
- same key with a different method, path, or payload: HTTP 409;
- same key while processing: HTTP 409;
- keys expire after `PUBLIC_API_IDEMPOTENCY_TTL_HOURS`.

## Error format

```json
{
  "ok": false,
  "error": {
    "code": "validation_error",
    "message": "Validation failed",
    "requestId": "..."
  }
}
```

The same request ID is returned in the configured request-ID response header.

## Send a template

```bash
curl -X POST https://your-domain.com/api/v1/messages/send-template \
  -H "Authorization: Bearer tk_live_xxxxx" \
  -H "Idempotency-Key: msg_12345" \
  -H "Content-Type: application/json" \
  -d '{"to":"918810386013","templateName":"hello_world","language":"en_US","bodyParameters":[]}'
```

OpenAPI JSON is available at `/api/v1/openapi.json`.
