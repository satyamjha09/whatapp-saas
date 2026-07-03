# Uptime Monitoring

metawhat includes internal uptime monitoring for production URLs.

## What it monitors

- public app URL
- health API
- deep health API
- latency
- status codes
- failures
- recovery

## Environment

```env
UPTIME_MONITORING_ENABLED="true"
UPTIME_MONITORING_DEFAULT_TIMEOUT_MS="10000"
UPTIME_MONITORING_RETENTION_DAYS="30"
UPTIME_MONITORING_AUTO_INCIDENTS="true"

UPTIME_MONITOR_PUBLIC_URL="https://your-domain.com"
UPTIME_MONITOR_HEALTH_URL="https://your-domain.com/api/health"
UPTIME_MONITOR_DEEP_HEALTH_URL="https://your-domain.com/api/health/deep"
```

## Seeding default monitors

To seed default uptime monitors configured via the environment variables, run:

```bash
npm run uptime:seed
```

## Dashboard

Uptime monitors can be inspected and triggered manually at:
- `/dashboard/system/uptime-monitors`
- `/dashboard/system/uptime-monitors/[monitorId]`

## Incident Behavior

After repeated failures (consecutive failures exceeding the `failureThreshold`), the uptime monitoring system automatically opens a production incident.

Once the endpoint recovers (consecutive successes exceeding the `recoveryThreshold`), the incident is resolved automatically.

## Maintenance Worker

The maintenance worker checks for due uptime monitors once every minute. Old checks are purged daily by the retention clean up job.
