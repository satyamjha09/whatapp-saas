# Compliance Evidence Center

Compliance Evidence Center generates downloadable JSON evidence packs for audits, legal review, enterprise customers, and operational checks.

## Dashboard

```txt
/dashboard/system/compliance
```

## Environment

```env
COMPLIANCE_EVIDENCE_CENTER_ENABLED="true"
COMPLIANCE_EVIDENCE_EXPORT_DIR="./private/compliance-evidence"
COMPLIANCE_EVIDENCE_EXPORT_TTL_HOURS="72"
COMPLIANCE_EVIDENCE_MAX_RANGE_DAYS="365"
```

## Export Types

- `COMPANY_COMPLIANCE`
- `CONTACT_COMPLIANCE`
- `PRIVACY_COMPLIANCE`
- `SECURITY_COMPLIANCE`
- `RETENTION_COMPLIANCE`

## Evidence Included

Company compliance includes company metadata, consent summaries, privacy request summaries, audit logs, incidents, security events, data retention runs, legal holds, and status page incidents.

Contact compliance includes the contact profile, consent events, privacy requests, messages and message events, and audit logs related to the contact.

Privacy compliance includes privacy requests, public privacy verifications, and privacy request summaries.

Security compliance includes security events, incidents, and audit integrity chain fields.

Retention compliance includes data retention policies, retention runs and items, and legal holds.

## File Expiry

Generated exports expire after `COMPLIANCE_EVIDENCE_EXPORT_TTL_HOURS`.

Expired files are removed by the maintenance worker and the export record is marked `EXPIRED`.

## Safety

Exports are admin-only. Files are stored outside public app paths. Downloads create audit logs. Failed exports create incidents.
