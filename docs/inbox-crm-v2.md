# Inbox CRM v2

Inbox CRM v2 adds customer profile management and timeline history to metawhat.

## Features

- Customer profile fields
- Lifecycle stage
- Assignment history
- Priority and status activity
- Message timeline
- Internal notes timeline
- Saved inbox views

## CRM Page

```txt
/dashboard/contacts/[contactId]/crm
```

## Saved Views

```txt
/dashboard/inbox/saved-views
```

## Activity Recording

```ts
await recordContactActivity({
  companyId,
  contactId,
  actorUserId,
  type: "PRIORITY_CHANGED",
  title: "Priority changed",
  metadata: {
    previousPriority,
    nextPriority,
  },
});
```

Recommended activity events:

- Assignment changes
- Status changes
- Priority changes
- Snooze and unsnooze
- Block and unblock
- Opt-out and opt-in
- Inbound and outbound messages
- Notes
- Tags
- Profile updates
