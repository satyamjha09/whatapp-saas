# Multi-Tenant SaaS Architecture

TallyKonnect is a multi-tenant SaaS platform.

## Account Levels

```txt
Platform Owner / Super Admin
↓
Company / Partner Workspace
↓
Company Team Users
↓
End Customers / Contacts
```

## Platform Owner

Can manage:

```txt
All companies
Partners
Billing
Plans
System health
Support
Security
Compliance
Suspension
```

## Company / Partner

Each company has isolated:

```txt
WhatsApp accounts
Contacts
Messages
Campaigns
CRM
Wallet
Billing
Reports
Team users
Automations
Lead scoring
Sales pipeline
```

## Partners

Partner companies can manage child companies.

```txt
Partner
↓
Partner Client 1
Partner Client 2
Partner Client 3
```

## Critical Data Isolation Rule

Every business table must include:

```txt
companyId
```

Every query must filter by:

```txt
companyId
```

## User Roles

Company roles:

```txt
OWNER
ADMIN
MEMBER
```

Platform roles:

```txt
NONE
SUPPORT
FINANCE
ADMIN
SUPER_ADMIN
```

## URLs

```txt
/onboarding/company
/platform/companies
/dashboard
```
