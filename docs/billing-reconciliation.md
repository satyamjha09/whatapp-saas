# Billing Reconciliation

Billing reconciliation verifies that wallet balances, wallet transactions, and
per-message usage ledgers agree.

## Checks

- wallet balance equals the signed successful transaction ledger;
- every charged usage ledger has a same-company wallet debit;
- each debit equals the sum of its linked usage ledgers;
- a message has no duplicate charges;
- deleted-message usage ledgers are detected;
- message-usage debits without a usage ledger are detected.

Bulk sends keep one aggregate wallet debit and create one usage ledger per
message. Reconciliation compares that debit to the sum of the linked rows.

## Environment

```env
BILLING_RECONCILIATION_ENABLED="true"
BILLING_RECONCILIATION_AUTO_INCIDENTS="true"
```

## Dashboard and schedule

Open `/dashboard/system/billing-reconciliation` to run reconciliation manually
and inspect prior runs. The maintenance worker runs it daily at 04:15.

Critical or high mismatches create a billing incident linked to the failed run.
