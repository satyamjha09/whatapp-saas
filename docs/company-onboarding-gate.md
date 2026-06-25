# Company Onboarding Gate

The company onboarding gate keeps newly created workspaces in
`PENDING_ONBOARDING` until required setup is complete. Pending companies are
sent to `/dashboard/onboarding`, where admins can review the first setup
checklist, save required profile fields, and activate the workspace.

## Environment

```env
COMPANY_ONBOARDING_GATE_ENABLED="true"
COMPANY_ONBOARDING_REQUIRE_PROFILE="true"
COMPANY_ONBOARDING_REQUIRE_WHATSAPP_CONNECT="false"
COMPANY_ONBOARDING_REQUIRE_BILLING="false"
```

## Flow

1. Signup creates a company with status `PENDING_ONBOARDING`.
2. Dashboard layout checks the current company onboarding state.
3. Pending companies are redirected to `/dashboard/onboarding`.
4. Admins complete required checklist items.
5. `POST /api/company/onboarding` validates required steps and changes company
   status to `ACTIVE`.
6. Active companies can access the normal dashboard routes.

## Required Checks

Profile setup uses the company fields `name`, `businessCategory`, `city`, and
`pinCode`.

WhatsApp setup checks for at least one `WhatsAppPhoneNumber` with a
`phoneNumberId`.

Billing setup checks whether the company has a wallet row.

## API

`GET /api/company/onboarding` returns the current onboarding state.

`PATCH /api/company/onboarding` updates company profile fields during
onboarding.

`POST /api/company/onboarding` activates the company when all required steps are
complete.
