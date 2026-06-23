# Dead Letter Queue

TallyKonnect syncs failed BullMQ jobs into a database-backed dead letter queue.

## Dashboard

Open `/dashboard/system/dead-letter-queue` to:

- view and filter failed jobs by queue and status;
- inspect the failure reason, stack trace, and redacted payload;
- retry the original BullMQ job;
- ignore a reviewed failure with a reason;
- manually synchronize failed jobs.

## Environment

```env
DEAD_LETTER_QUEUE_ENABLED="true"
DEAD_LETTER_QUEUE_SYNC_LIMIT="100"
```

## Automatic synchronization

The maintenance worker synchronizes failed jobs every 10 minutes. Run it with
`npm run worker:maintenance`.

## Safe replay

Review the failure reason and payload before retrying. Confirm idempotency before
replaying payment, wallet, billing, or webhook work. The retry and ignore actions
are restricted to owners/admins and recorded in the audit log.
