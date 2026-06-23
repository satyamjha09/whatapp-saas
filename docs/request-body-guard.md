# Request Body Guard

TallyKonnect blocks oversized request bodies before parsing JSON.

## Why

`request.json()` can consume memory if an attacker sends a huge body.

The request body guard checks:

- `Content-Length`
- streamed body bytes
- JSON validity

## Environment

```env
REQUEST_BODY_GUARD_ENABLED="true"

MAX_JSON_BODY_BYTES="1048576"
MAX_WEBHOOK_BODY_BYTES="1048576"
MAX_CSP_REPORT_BODY_BYTES="65536"
MAX_BULK_MESSAGE_BODY_BYTES="5242880"
MAX_CONTACT_IMPORT_BODY_BYTES="5242880"
MAX_PUBLIC_API_BODY_BYTES="1048576"
```

## Response

Oversized payloads return:

```txt
413 Payload Too Large
```

Response body:

```json
{
  "message": "Payload too large",
  "maxBytes": 1048576
}
```

The app also records a `SUSPICIOUS_REQUEST` security event.

## Testing

```bash
python - <<'PY'
import requests
payload = "x" * (100 * 1024)
r = requests.post(
  "http://localhost:3000/api/security/csp-report",
  data=payload,
  headers={"Content-Type": "text/plain"}
)
print(r.status_code)
print(r.text)
PY
```

Expected:

```txt
413
```

Normal CSP reports should still work:

```bash
curl -i -X POST http://localhost:3000/api/security/csp-report \
  -H "Content-Type: application/csp-report" \
  -d '{"csp-report":{"document-uri":"http://localhost:3000/dashboard","violated-directive":"script-src","blocked-uri":"https://evil.example/script.js"}}'
```
