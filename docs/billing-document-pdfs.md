# Billing Document PDFs

Billing Document PDFs generate invoice and credit note PDFs.

## Environment

```env
BILLING_PDFS_ENABLED="true"
BILLING_PDFS_ATTACH_TO_EMAILS="true"
BILLING_PDFS_RENDER_LOG_ENABLED="true"
BILLING_PDF_FOOTER_TEXT="This is a system-generated billing document."
```

## Routes

- `GET /api/billing/invoices/[invoiceId]/pdf`
- `GET /api/billing/credit-notes/[creditNoteId]/pdf`

## Email attachments

When enabled, invoice and credit note emails attach generated PDFs:
`BILLING_PDFS_ATTACH_TO_EMAILS="true"`

## Safety

- PDF render attempts are logged in the `BillingDocumentPdfRender` table.
- Failed PDF generation appears in System Health.
- PDFs use invoice/credit note snapshots.
- Existing invoices are not mutated.
