# Database Backup and Restore

TallyKonnect uses PostgreSQL. Production backups are created with `pg_dump` in custom format.

## Required environment

```env
DATABASE_BACKUPS_ENABLED="true"
DATABASE_BACKUP_DIR="./backups/postgres"
DATABASE_BACKUP_RETENTION_DAYS="14"
PG_DUMP_PATH="pg_dump"
```

Set `DATABASE_BACKUPS_ENABLED="true"` only after `pg_dump` is installed and accessible from the web and worker process environment.

## Off-server backup storage

Production should upload backups to S3-compatible storage such as AWS S3 or Cloudflare R2.

```env
DATABASE_BACKUP_REMOTE_STORAGE_ENABLED="true"
S3_BACKUP_BUCKET="your-bucket"
S3_BACKUP_REGION="auto"
S3_BACKUP_ENDPOINT="https://your-r2-or-s3-endpoint"
S3_BACKUP_ACCESS_KEY_ID="..."
S3_BACKUP_SECRET_ACCESS_KEY="..."
S3_BACKUP_PREFIX="tallykonnect/postgres"
```

Each backup stores:

- local file name
- SHA256 checksum
- remote bucket
- remote key
- remote upload timestamp

## Download backup from S3/R2

Use your storage provider dashboard or CLI to download the `.dump` file.

Then verify checksum:

```bash
sha256sum YOUR_BACKUP_FILE.dump
```

Compare it with `DatabaseBackupRun.checksumSha256`.

## Backup verification

Every scheduled backup should be verified after creation.

Verification checks:

- local backup file exists
- local SHA256 checksum matches stored checksum
- remote object exists when remote storage is enabled
- remote object size matches local file size
- remote checksum metadata matches when available

Manual verification:

```txt
/dashboard/system/health -> Verify Latest Backup
```

A backup is not considered healthy unless the latest completed backup is verified.

## Manual backup

From the dashboard:

```txt
/dashboard/system/health -> Run Backup
```

Or from the server:

```bash
pg_dump \
  --dbname "$DATABASE_URL" \
  --format custom \
  --no-owner \
  --no-acl \
  --file ./backups/postgres/manual-backup.dump
```

## Restore into a fresh database

Never restore directly over production without a maintenance window.

```bash
createdb tallykonnect_restore_test

pg_restore \
  --dbname "postgresql://postgres:password@localhost:5432/tallykonnect_restore_test" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  ./backups/postgres/YOUR_BACKUP_FILE.dump
```

## Verify restore

```bash
psql "postgresql://postgres:password@localhost:5432/tallykonnect_restore_test" \
  -c "select count(*) from \"Company\";"
```

## Production restore checklist

1. Put app into maintenance mode.
2. Stop PM2 processes.
3. Create one final backup.
4. Restore selected backup into production database.
5. Run Prisma migrations if needed.
6. Start PM2 processes.
7. Open `/dashboard/system/health`.
8. Verify WhatsApp send, webhook receive, billing, and inbox access.

## Maintenance mode before restore

Before a production restore:

1. Open `/dashboard/system/health`.
2. Enable Maintenance Mode.
3. Confirm message sending and billing write actions are blocked.
4. Stop PM2 workers if needed.
5. Create one final backup.
6. Restore the selected backup.
7. Start PM2 workers.
8. Verify `/dashboard/system/health`.
9. Disable Maintenance Mode.

## Important

Store production backups outside the application server when possible. Local backups are helpful, but off-server storage is safer.
