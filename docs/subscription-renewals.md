# Subscription Renewals

Subscription Renewals handle paid plan period expiry, reminders, past-due grace
period, and auto downgrade.

## Environment

```env
SUBSCRIPTION_RENEWALS_ENABLED="true"
SUBSCRIPTION_RENEWAL_GRACE_DAYS="7"
SUBSCRIPTION_RENEWAL_REMINDER_DAYS="7,3,1"
SUBSCRIPTION_AUTO_DOWNGRADE_AFTER_GRACE="true"
SUBSCRIPTION_RENEWAL_SCAN_CRON="15 6 * * *"

SUBSCRIPTION_DOWNGRADE_PLAN="FREE"
SUBSCRIPTION_FREE_MONTHLY_MESSAGE_LIMIT="100"
```

## Dashboard

`/dashboard/billing/subscription-renewals`

## Flow

1. Paid plan has `currentPeriodEnd`.
2. Reminder notifications are created 7/3/1 days before expiry.
3. After expiry, company becomes `PAST_DUE`.
4. Grace period starts.
5. If unpaid after grace, company is downgraded to `FREE`.
6. Plan change ledger and audit logs are created.

## Manual Scan

Use the dashboard button or run the maintenance worker.

## Safety

- Events are idempotent.
- Auto downgrade creates plan change history.
- Past-due status works with feature entitlement blocking.
- Users are notified before downgrade.
