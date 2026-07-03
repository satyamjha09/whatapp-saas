# Security Events

metawhat logs security violations (such as CSP reports) as `SecurityEvent` database records to provide visibility and audit trails.

## Resolving events

Open a security event from:

```txt
/dashboard/system/health
```

Use the detail page to:

- Inspect event metadata
- Confirm whether the violation is expected
- Add trusted domains to CSP config if needed
- Resolve the event with a note
- Reopen the event if it was resolved by mistake

High and critical events continue to affect System Health until resolved.
