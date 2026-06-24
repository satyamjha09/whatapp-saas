# Scheduled Plan Changes

Scheduled Plan Changes handle self-serve cancellation and downgrade at period
end.

## Environment

```env
PLAN_CHANGE_SCHEDULER_ENABLED="true"
PLAN_CHANGE_SCHEDULER_CRON="35 6 * * *"
PLAN_CHANGE_ALLOW_SELF_SERVE_CANCEL="true"
PLAN_CHANGE_ALLOW_SELF_SERVE_DOWNGRADE="true"
PLAN_CHANGE_DEFAULT_DOWNGRADE_PLAN="FREE"
PLAN_CHANGE_FREE_MONTHLY_MESSAGE_LIMIT="100"
```

## Dashboard

`/dashboard/billing/subscription`

## Flow

1. User schedules cancellation or downgrade.
2. Existing paid plan remains active until `currentPeriodEnd`.
3. `cancelAtPeriodEnd` is set when applicable.
4. Scheduled change is applied by the maintenance worker.
5. Company plan changes.
6. Plan change ledger is created.
7. Audit log and notification are created.

## Undo

Users can undo the scheduled plan change before it is applied.

## Safety

- Only one scheduled change per company is active.
- New schedules cancel older scheduled changes.
- Failed changes are marked `FAILED`.
- Applied changes are recorded in `CompanyPlanChange`.
