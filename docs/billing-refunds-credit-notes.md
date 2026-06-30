# Billing Refunds and Credit Notes

Refunds let admins reverse paid invoices and create credit note records.

## Environment

```env
BILLING_REFUNDS_ENABLED="true"
BILLING_REFUNDS_DRY_RUN="false"
BILLING_REFUNDS_REQUIRE_CONFIRMATION="true"
BILLING_REFUNDS_CONFIRMATION_TEXT="CONFIRM_REFUND"
BILLING_REFUNDS_ALLOW_PARTIAL="true"
BILLING_REFUNDS_AUTO_DOWNGRADE_ON_FULL_REFUND="true"
```

## Dashboard
`/dashboard/billing/refunds`

## Flow
1. Admin selects paid invoice.
2. Admin enters refund amount.
3. Admin types confirmation text.
4. System creates Cashfree refund.
5. System creates BillingRefund row.
6. System creates BillingCreditNote row.
7. Full refund can downgrade company to FREE.
8. Audit log and notification are created.

## Safety
* Refund amount cannot exceed refundable invoice balance.
* Confirmation text is required.
* Dry-run mode exists for staging.
* Full refund can trigger downgrade.
* Credit notes are kept separate from invoices.

## Accounting note
Credit note format and tax treatment should be reviewed by your accountant before production use.
