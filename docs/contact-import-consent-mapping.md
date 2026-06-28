# Contact Import + Consent Mapping

This module imports contacts from CSV and maps WhatsApp marketing consent.

## Environment

```env
CONTACT_IMPORT_ENABLED="true"
CONTACT_IMPORT_MAX_ROWS="10000"
CONTACT_IMPORT_PREVIEW_LIMIT="100"
CONTACT_IMPORT_ALLOW_CONSENT_GRANTED_WITH_PROOF="true"
CONTACT_IMPORT_REQUIRE_CONSENT_PROOF_FOR_GRANTED="true"
CONTACT_IMPORT_DEFAULT_CONSENT_STATUS="UNKNOWN"
```

## CSV columns example

```csv
name,email,phone,city,companyName,marketingConsentStatus,marketingConsentProof,marketingConsentSource
Satyam,satyam@example.com,918178444398,Delhi,TallyKonnect,GRANTED,Website signup form,FORM
```

## Pages

```txt
/dashboard/contacts/import
```

## APIs

```txt
GET  /api/contacts/import
POST /api/contacts/import
POST /api/contacts/import/[jobId]/run
```

## Flow

```txt
Upload CSV
→ Map fields
→ Map consent fields
→ Preview rows
→ Invalid rows are skipped
→ Run import
→ Contacts are created or updated
→ Consent events are created
→ Campaigns can use GRANTED contacts
```

## Safety

```txt
Phone or email required
GRANTED consent requires proof
Duplicate strategy supports update or skip
Consent events are audit-friendly
Campaign-ready contacts require marketingConsentStatus = GRANTED
```
