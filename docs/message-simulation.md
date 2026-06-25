# Message Simulation

`ENABLE_MESSAGE_SIMULATION` controls whether the message worker may fake a Meta
message ID when a company has no connected WhatsApp credentials.

```env
ENABLE_MESSAGE_SIMULATION="false"
```

Keep this value `false` in production. With simulation disabled, missing
WhatsApp account credentials are treated as a permanent send failure, so the
message is marked failed through the normal worker failure path and any charged
wallet balance is refunded.

Set it to `true` only for local demos or development environments where you
explicitly want messages to appear as sent without calling Meta.
