# Platform Company Control Center

This module gives TallyKonnect platform admins control over all companies and
partners.

## Environment

```env
PLATFORM_COMPANY_CONTROL_ENABLED="true"
PLATFORM_COMPANY_APPROVAL_REQUIRED="false"
PLATFORM_COMPANY_INTERNAL_NOTES_ENABLED="true"
```

## Pages

```txt
/platform/companies
/platform/companies/[companyId]
```

## Platform Actions

```txt
Activate company
Suspend company
Reactivate company
Disable company
Add internal platform note
View team
View partner clients
View WhatsApp account info
View signup/account details
```

## Signup Fields Visible

```txt
Business Name
Business Category
Personal Name
Email
Mobile
City
PIN Code
Employee Code
WhatsApp Consent
```

## Removed Fields

```txt
Channel Partner
Referral Code
```

## Security

Only platform admins can access these pages and APIs:

```ts
requirePlatformAdmin()
```

## Company Statuses

```txt
PENDING_ONBOARDING
ACTIVE
SUSPENDED
DISABLED
```
