# Public Privacy Portal

The Public Privacy Portal allows customers to request data export or deletion/anonymization.

## Public URL

```txt
/privacy
/privacy/confirm?token=...
```

## Environment

```env
PUBLIC_PRIVACY_PORTAL_ENABLED="true"
PUBLIC_PRIVACY_PORTAL_URL="https://your-domain.com/privacy"
PUBLIC_PRIVACY_TOKEN_SECRET="use_a_long_random_secret_32_chars_min"
PUBLIC_PRIVACY_TOKEN_TTL_MINUTES="30"
PUBLIC_PRIVACY_MAX_REQUESTS_PER_EMAIL_PER_DAY="3"

PUBLIC_PRIVACY_EMAIL_FROM="metawhat Privacy <privacy@your-domain.com>"
PUBLIC_PRIVACY_EMAIL_REPLY_TO="support@your-domain.com"
```

## Flow

1. Customer opens `/privacy`.
2. Customer submits email and WhatsApp number.
3. System emails a verification link.
4. Customer confirms the link.
5. A verified privacy request is created in Privacy Center.
6. Admin processes export or delete from `/dashboard/system/privacy`.

## Safety

- No data is shown publicly.
- Export files are only downloadable by authenticated admins.
- Deletion is processed only after verified request creation.
- Email and token hashes are HMAC-protected.
- Request abuse is rate-limited per email.
