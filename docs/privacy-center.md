# Privacy Center

Privacy Center handles customer data export and deletion requests.

## Dashboard

```txt
/dashboard/system/privacy
```

## Environment

```env
PRIVACY_CENTER_ENABLED="true"
PRIVACY_EXPORT_DIR="./private/privacy-exports"
PRIVACY_EXPORT_TTL_HOURS="72"
PRIVACY_DELETE_REQUIRE_CONFIRMATION="true"
PRIVACY_REQUEST_RETENTION_DAYS="365"
```

## Contact Export

Creates a JSON file containing:

- contact profile
- messages
- message events
- inbox notes
- tags
- campaign memberships
- group memberships

Exports expire after `PRIVACY_EXPORT_TTL_HOURS`.

## Contact Deletion

The deletion flow anonymizes the contact instead of physically deleting financial or audit-linked records. It removes direct identifiers and blocks future messaging.

## Confirmation

Deletion requires:

```txt
DELETE CONTACT DATA
```

## Maintenance

The maintenance worker:

- removes expired export files
- removes old completed, failed, and cancelled privacy request records

## Audit

All create, process, and download actions are written to audit logs.
