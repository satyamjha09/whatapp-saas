# Billing Ops Manual Review

Billing Ops lets admins review payment reconciliation issues safely.

## Environment

```env
BILLING_OPS_ENABLED="true"
BILLING_OPS_REQUIRE_CONFIRMATION="true"
BILLING_OPS_CONFIRMATION_TEXT="CONFIRM_PAYMENT_REVIEW"
BILLING_OPS_MAX_PENDING_REVIEW_AGE_HOURS="72"
```

## Dashboard
`/dashboard/billing/ops`

## When to approve
Only approve after matching all of these in Cashfree Dashboard:
* Cashfree order ID
* Cashfree payment ID
* captured status
* amount
* currency
* customer/company context

## Approval effect
Approving a manual review:
* Marks checkout PAID
* Updates company billing plan
* Creates CompanyPlanChange
* Creates invoice
* Creates reconciliation event
* Creates audit log
* Notifies company

## Rejection effect
Rejecting a manual review:
* Marks checkout FAILED
* Stores review notes
* Creates reconciliation event
* Creates audit log
* Notifies company
