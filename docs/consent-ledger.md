# Consent Ledger

The Consent Ledger records opt-in and opt-out proof for WhatsApp messaging.

## Environment

```env
CONSENT_LEDGER_ENABLED="true"
CONSENT_REQUIRE_MARKETING_OPT_IN="true"
CONSENT_RETENTION_DAYS="1825"
CONSENT_ALLOW_UTILITY_WITHOUT_MARKETING_OPT_IN="true"
```

## Behavior

Marketing templates are blocked unless the contact has `marketingConsentStatus = GRANTED`.
STOP-style keywords revoke marketing consent. START-style keywords grant marketing consent again.

## Evidence

Consent events may store source, evidence text, evidence URL, IP address, user agent, actor user, and metadata.

## CSV Import

The contact group CSV importer supports these optional columns:

```csv
marketingConsent,marketingConsentEvidence,utilityConsent,utilityConsentEvidence
```

Use `yes`, `true`, or `granted` to grant consent. Use `no`, `false`, or `revoked` to revoke consent.

## Public API

`POST /api/v1/contacts/consent`

Requires:

```txt
Authorization: Bearer <api_key>
Idempotency-Key: <unique_key>
```

The API key must include the `CONTACTS_WRITE` scope.

## Dashboard

Admin consent controls and history are available at:

```txt
/dashboard/contacts/[contactId]/crm
```
