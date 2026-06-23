# Production Rollback Runbook

This rollback is a code rollback. It does not automatically downgrade the database.

## When to use

Use rollback when a deploy causes:
- build/runtime failures
- broken dashboard pages
- failed health checks
- message sending regressions
- worker crashes

## Before rollback

Find the previous good commit:
```bash
git log --oneline -10
```

## Run rollback

```bash
npm run rollback:production -- <commit-sha-or-tag>
```

Example:
```bash
npm run rollback:production -- abc1234
```

## What rollback does

1. Enables maintenance mode.
2. Creates and verifies a database backup.
3. Checks out the target commit/tag.
4. Runs `npm install`.
5. Runs Prisma generate.
6. Builds the app.
7. Restarts PM2.
8. Runs public health check.
9. Runs deep health check.
10. Disables maintenance mode only after success.

## Important database note

This rollback does not run automatic database downgrade scripts. If the failed deploy included destructive or incompatible migrations, use the database restore runbook instead.

## Failure behavior

By default, maintenance mode remains enabled when rollback fails. Check:
```bash
npm run pm2:status
npm run pm2:logs
```

Then open:
`/dashboard/system/health`

## Optional env flags

```env
ROLLBACK_REQUIRE_BACKUP="true"
ROLLBACK_DISABLE_MAINTENANCE_ON_FAILURE="false"
ROLLBACK_ALLOW_DIRTY="false"
```

## Operation lock

Rollback uses the same global production operation lock as deploy.

If another deploy or rollback is running, rollback will refuse to start.

If a previous operation crashed, check:
`/dashboard/system/health`

Only force release the lock after confirming no production script is still running.

