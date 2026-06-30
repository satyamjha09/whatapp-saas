# Security Headers

TallyKonnect adds browser security headers through `src/middleware.ts`.

## Headers

The app sends:

- `Content-Security-Policy` or `Content-Security-Policy-Report-Only`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `Cross-Origin-Opener-Policy`
- `Strict-Transport-Security` in production

## CSP mode

Start production with:

```env
SECURITY_CSP_MODE="report-only"
```

After testing dashboard, Clerk login, Meta embedded signup, and Cashfree checkout, switch to:

```env
SECURITY_CSP_MODE="enforce"
```

## Public API CORS

CORS is only applied to configured public API prefixes:

```env
PUBLIC_API_CORS_PATH_PREFIXES="/api/public,/api/v1"
PUBLIC_API_ALLOWED_ORIGINS="https://customer-app.com,https://partner.com"
```

Do not add dashboard routes to public CORS.

## Testing

```bash
curl -I https://yourdomain.com/dashboard
```

Check for:

```txt
Content-Security-Policy-Report-Only
X-Content-Type-Options
X-Frame-Options
Referrer-Policy
Permissions-Policy
Strict-Transport-Security
```

Test preflight:

```bash
curl -i -X OPTIONS \
  -H "Origin: https://customer-app.com" \
  -H "Access-Control-Request-Method: POST" \
  https://yourdomain.com/api/v1/messages
```
