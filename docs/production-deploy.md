# Production Deploy Runbook

This deploy flow is intended to be run on the production server.

## Before first deploy

Make sure these are configured:

```env
NEXT_PUBLIC_APP_URL="https://yourdomain.com"
APP_URL="https://yourdomain.com"
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
HEALTHCHECK_TOKEN="long-random-secret"

DATABASE_BACKUPS_ENABLED="true"
DEPLOY_REQUIRE_BACKUP="true"
DEPLOY_DISABLE_MAINTENANCE_ON_FAILURE="false"
```

PM2 should already be configured:

```bash
npm run pm2:start
npm run pm2:save
```

## Deploy

```bash
cd /path/to/whatsapp-saas

git pull origin main
npm install

npm run deploy:production
```

## What the deploy script does

1. Enables maintenance mode.
2. Creates a PostgreSQL backup.
3. Verifies the latest backup.
4. Runs Prisma migrations.
5. Generates Prisma client.
6. Builds Next.js.
7. Restarts PM2 web and worker processes.
8. Checks `/api/health`.
9. Checks `/api/health/deep`.
10. Disables maintenance mode after success.

## Failed deploy

If deploy fails, maintenance mode stays enabled by default.

Open:
`/dashboard/system/health`

Then review:
```bash
npm run pm2:status
npm run pm2:logs
```

After fixing the issue, rerun:
```bash
npm run deploy:production
```

Or manually disable maintenance mode from System Health.

## Manual health checks
```bash
npm run healthcheck
npm run healthcheck:deep
```

## Rollback notes

A safe rollback should follow this order:

1. Keep maintenance mode enabled.
2. Checkout the previous known-good commit.
3. Run `npm install`.
4. Run `npm run build`.
5. Run `npm run pm2:restart`.
6. Run health checks.
7. Disable maintenance mode.

Database rollbacks should only be done using the database restore runbook.

## Deployment history

Every deploy attempt writes a deployment record to the database.

Open:
`/dashboard/system/health`

The deployment table shows:
*   deploy status
*   commit SHA
*   branch
*   started/completed time
*   failed stage, if any

Each deploy records these steps:
*   maintenance mode enabled
*   backup completed
*   migrations completed
*   Prisma generated
*   build completed
*   PM2 restarted
*   public healthcheck passed
*   deep healthcheck passed
*   maintenance mode disabled
## Production operation lock

Deploys use a global production operation lock.

This prevents multiple risky operations from running at the same time:
- deploy
- rollback
- backup
- restore
- maintenance operation

If a deploy crashes, the lock expires automatically after its TTL.

You can inspect the current lock here:
`/dashboard/system/health`

Only force release the lock if you are sure no deploy or rollback process is still running.
