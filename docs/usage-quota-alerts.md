# Usage Quota Alerts

Usage Quota Alerts notify companies when usage approaches plan limits.

## Environment

```env
USAGE_QUOTA_ALERTS_ENABLED="true"
USAGE_QUOTA_ALERT_THRESHOLDS="80,90,100"
USAGE_QUOTA_ALERTS_AUTO_NOTIFY="true"
USAGE_QUOTA_ALERTS_SCAN_CRON="25 5 * * *"
```

## Dashboard

```text
/dashboard/billing/usage-quotas
```

## Flow

Usage counters track feature usage.
The alert scanner checks counters against plan and override limits.
Alerts are created at 80%, 90%, and 100%.
A company notification is created.
The dashboard shows upgrade nudges.
Users can acknowledge alerts.

## Manual Scan

Click Scan Alerts on the Usage Quotas dashboard.

## Scheduled Scan

The maintenance worker runs daily using:

```env
USAGE_QUOTA_ALERTS_SCAN_CRON="25 5 * * *"
```
