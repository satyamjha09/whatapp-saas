# Safe Logging

metawhat uses a safe logger that redacts secrets before writing logs or storing security metadata.

## Environment

```env
APP_LOG_LEVEL="info"
APP_LOG_FORMAT="json"
APP_LOG_REDACTION_ENABLED="true"
APP_REQUEST_ID_HEADER="x-request-id"
```

Use pretty logs locally:

```env
APP_LOG_FORMAT="pretty"
```

Use JSON logs in production:

```env
APP_LOG_FORMAT="json"
```

## Redacted fields

The logger redacts keys containing:

- token
- secret
- password
- authorization
- cookie
- api key
- private
- signature
- encryption key

## Request IDs

Every response receives:

```txt
x-request-id
```

Use this ID to trace a request across browser, API response, PM2 logs, and security events.

## Usage

```ts
import { logger } from "@/server/utils/safe-logger";

logger.info("Message sent", {
  messageId,
  companyId,
});

logger.error("Webhook failed", {
  error,
  signature: request.headers.get("x-hub-signature-256"),
});
```

The signature is automatically redacted.
