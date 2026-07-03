# CSRF Origin Guard

metawhat protects authenticated dashboard/internal API mutations with an Origin/Referer guard.

## What it blocks

For these HTTP methods:

```txt
POST, PUT, PATCH, DELETE
```

The middleware checks that the request came from a trusted browser origin.

Cross-site form/fetch attacks are rejected with:

```txt
403 Forbidden
```

## Trusted origins

Configure:

```env
NEXT_PUBLIC_APP_URL="https://metawhat.com"
CSRF_TRUSTED_ORIGINS="https://metawhat.com,https://www.metawhat.com"
```

## Excluded routes

These paths are excluded because they are server-to-server or public API paths:

- `/api/webhooks`
- `/api/security/csp-report`
- `/api/health`
- `/api/public`
- `/api/v1`
- `/api/auth`
- `/api/clerk`

Add extra prefixes only when required:

```env
CSRF_EXCLUDED_PATH_PREFIXES="/api/custom-webhook"
```

## Testing blocked origin

```bash
curl -i -X POST http://localhost:3000/api/messages/single-template \
  -H "Origin: https://evil.example" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected:

```txt
403 Forbidden
X-CSRF-Origin-Guard: blocked
```

## Testing same origin

```bash
curl -i -X POST http://localhost:3000/api/messages/single-template \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected:
*   Not blocked by CSRF guard.
*   Route may still return 401/400 depending on auth/body.
