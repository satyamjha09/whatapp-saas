# Billing Invoices

Billing invoices create a receipt and invoice ledger for paid plan upgrades and future billing events.

## Environment

```env
BILLING_INVOICES_ENABLED="true"
BILLING_INVOICE_PREFIX="TK"
BILLING_INVOICE_TAX_BASIS_POINTS="0"

BILLING_SELLER_NAME="metawhat"
BILLING_SELLER_EMAIL="billing@your-domain.com"
BILLING_SELLER_ADDRESS="Your business address"
BILLING_SELLER_TAX_ID=""
```

## Dashboard

```text
/dashboard/billing/invoices
```

## Printable Invoice

```text
/dashboard/billing/invoices/[invoiceId]
```

## Tax Configuration

`BILLING_INVOICE_TAX_BASIS_POINTS` controls tax percentage.

```text
0     = 0%
1800  = 18%
500   = 5%
```

Use accountant-approved tax settings before production.

## Flow

User upgrades plan.
Cashfree payment is verified.
Company plan updates.
Plan change ledger is created.
Billing invoice is created.
User can view and print the receipt.
