# Data Retention + Legal Hold

The Data Retention Engine removes old operational records according to configured policies.

## Dashboard

```txt
/dashboard/system/data-retention
```

## Environment

```env
DATA_RETENTION_ENABLED="true"
DATA_RETENTION_DRY_RUN="true"
DATA_RETENTION_AUTO_INCIDENTS="true"

DATA_RETENTION_DEFAULT_MESSAGE_EVENT_DAYS="365"
DATA_RETENTION_DEFAULT_PROVIDER_WEBHOOK_DAYS="180"
DATA_RETENTION_DEFAULT_SECURITY_EVENT_DAYS="365"
DATA_RETENTION_DEFAULT_STATUS_EMAIL_DELIVERY_DAYS="180"
DATA_RETENTION_DEFAULT_PUBLIC_PRIVACY_VERIFICATION_DAYS="90"
```

## Seed Policies

```bash
npm run retention:seed
```

## Dry-Run First

Keep this enabled for the first production run:

```env
DATA_RETENTION_DRY_RUN="true"
```

Review counts in:

```txt
/dashboard/system/data-retention
```

Then disable dry-run only when ready:

```env
DATA_RETENTION_DRY_RUN="false"
```

## Legal Holds

Legal holds protect specific entities from deletion.

Supported hold types:

- `CONTACT`
- `COMPANY`
- `MESSAGE`
- `PRIVACY_REQUEST`
- `INCIDENT`

## Scheduled Job

The maintenance worker runs data retention daily at 04:10.

## Incident Behavior

Failed retention runs create an incident when:

```env
DATA_RETENTION_AUTO_INCIDENTS="true"
```
