# Platform Admin Console

The platform admin console is an internal super-admin area for TallyKonnect operators.

## URL

```txt
/dashboard/platform
```

## Environment

```env
PLATFORM_ADMIN_ENABLED="true"
PLATFORM_ADMIN_EMAILS="satyamjhaactor07@gmail.com"
```

## Access model

Platform admin access is separate from company roles.

A user must have an email listed in:

```txt
PLATFORM_ADMIN_EMAILS
```

Non-admin access attempts are recorded as high-severity security events.

## What it shows

- all companies
- billing plan and subscription status
- WhatsApp connection status
- wallet balance
- usage counts
- recent messages
- recent webhook events
- recent company audit logs

## Safety

Start as read-only.

Do not add destructive actions like deleting companies, changing balances, or impersonation until they have:

- confirmation dialogs
- reason fields
- platform audit logs
- incident references
- rollback path
