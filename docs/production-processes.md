# Production Processes

metawhat requires one web process and several worker processes. Use PM2, or an equivalent process manager, to keep them running and automatically restart them after crashes or server reboots.

## Required processes

- `metawhat-web`
- `metawhat-message-worker`
- `metawhat-bulk-message-worker`
- `metawhat-webhook-worker`
- `metawhat-developer-webhook-worker`
- `metawhat-developer-webhook-outbox-worker`
- `metawhat-inbox-sla-worker`
- `metawhat-maintenance-worker`
- `metawhat-notification-email-worker`

Bulk and campaign sends are processed through `src/workers/message.worker.ts` in this codebase. The PM2 `metawhat-bulk-message-worker` process runs the same queue consumer with a distinct heartbeat name so production can scale and monitor it separately.

## First deploy

```bash
npm install
npx prisma migrate deploy
npm run build
npm run pm2:start
npm run pm2:save
```

## Check status

```bash
npm run pm2:status
npm run pm2:logs
```

## Restart all processes

```bash
npm run pm2:restart
```

## After code deploy

```bash
git pull
npm install
npx prisma migrate deploy
npm run build
npm run pm2:restart
```

## Health checks

Open `/dashboard/system/health`.

Expected:

- Database connected
- Redis connected
- Required workers running
- Queue backlog healthy
- Maintenance jobs completing

## Notes

The maintenance worker is required. Without it, cleanup jobs, subscription expiry checks, webhook recovery, notification cleanup, and health alerts will not run.

## Health check endpoints

Public uptime check:

```bash
curl https://yourdomain.com/api/health
```

Expected:

```json
{
  "ok": true,
  "service": "metawhat",
  "database": "ok",
  "redis": "ok"
}
```

Deep internal health check:

```bash
curl -H "x-healthcheck-token: $HEALTHCHECK_TOKEN" \
  https://yourdomain.com/api/health/deep
```

The deep check verifies Redis, database, queue backlog, worker heartbeats, missing workers, and recent failed maintenance jobs.

Local healthcheck:

```bash
npm run healthcheck
npm run healthcheck:deep
```
