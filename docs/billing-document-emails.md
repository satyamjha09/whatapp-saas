# Billing Document Emails

Billing Document Emails send invoices and credit notes to customers.

## Environment

```env
BILLING_DOCUMENT_EMAILS_ENABLED="true"
BILLING_DOCUMENT_EMAILS_AUTO_SEND="true"
BILLING_DOCUMENT_EMAILS_FROM="metawhat Billing <billing@your-domain.com>"
BILLING_DOCUMENT_EMAILS_REPLY_TO="support@your-domain.com"
```

## SMTP
```env
SMTP_HOST="smtp.your-domain.com"
SMTP_PORT="587"
SMTP_USER="your-smtp-user"
SMTP_PASSWORD="your-smtp-password"
SMTP_FROM="metawhat <no-reply@your-domain.com>"
```

## Dashboard
```txt
/dashboard/billing/email-deliveries
```

## Auto-send events
*   Invoice created after paid plan upgrade.
*   Credit note created after refund.

## Manual send
Admins/users can resend:
*   invoice email from invoice list
*   credit note email from refunds list

## Safety
*   Delivery rows are stored.
*   Failed sends are visible.
*   Idempotency prevents duplicate auto-sends.
*   Manual resend uses force=true.
