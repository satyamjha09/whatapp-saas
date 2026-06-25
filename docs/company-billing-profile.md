# Company Billing Profile

Company Billing Profile stores customer invoice details.

## Environment

```env
BILLING_PROFILE_ENABLED="true"
BILLING_PROFILE_REQUIRE_BILLING_EMAIL="true"
BILLING_PROFILE_REQUIRE_LEGAL_NAME="true"
BILLING_PROFILE_TAX_ID_LABEL="Tax ID"
BILLING_PROFILE_ALLOW_CUSTOMER_EDIT="true"
```

## Dashboard
```txt
/dashboard/billing/profile
```

## Stored details
*   Legal / billing name
*   Billing email
*   Billing phone
*   Address
*   Country / state
*   Tax ID label
*   Tax ID
*   Invoice notes

## Invoice behavior
*   Future invoices copy billing profile data into invoice fields.
*   Older invoices are not mutated, because invoice records should remain historical snapshots.

## Safety
*   Profile updates are audited.
*   Update events store previous/new snapshots.
*   Tax ID label is configurable.
*   Customer tax treatment should be reviewed before production.
