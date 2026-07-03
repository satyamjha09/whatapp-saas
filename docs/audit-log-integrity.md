# Audit Log Integrity

metawhat hash-chains audit logs using HMAC-SHA256.

## Environment

```env
AUDIT_LOG_HASH_SECRET="use_a_long_random_32_plus_character_secret"
```

## How it works

Each audit log stores:

- `previousIntegrityHash`
- `integrityHash`
- `integrityVersion`

The hash includes important audit fields plus the previous hash.

If someone edits or deletes audit rows directly in the database, integrity verification can detect the broken chain.

## Verify

Open:

```txt
/dashboard/system/health
```

Click:

```txt
Verify Audit Integrity
```

## Important

Do not rotate `AUDIT_LOG_HASH_SECRET` without planning a migration strategy, because old hashes were created with the previous secret.
