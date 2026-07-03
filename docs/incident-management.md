# Incident Management

metawhat incidents track production-impacting issues.

## Sources

- SYSTEM
- SECURITY
- WORKER
- BACKUP
- WEBHOOK
- BILLING
- DEPLOYMENT
- DATABASE_RESTORE
- PLATFORM

## Statuses

- OPEN
- ACKNOWLEDGED
- RESOLVED

## Pages

```txt
/dashboard/incidents
/dashboard/incidents/[incidentId]
```

## Automatic creation

High and critical security events can open incidents automatically.

Recommended future automatic incident sources:

- failed database backup
- failed restore drill
- missing worker heartbeat
- repeated webhook failures
- failed deployment
- payment reconciliation mismatch
