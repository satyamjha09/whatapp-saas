# Secret Encryption and Key Rotation

TallyKonnect encrypts sensitive provider secrets with versioned AES-256-GCM encryption.

## Protected secrets

- WhatsApp access tokens
- Developer webhook signing secrets

API keys are not encrypted because raw API keys are not stored. Only hashes, prefix, and last4 are stored.

## Environment

Generate a key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Set:

```env
SECRET_ENCRYPTION_V2_ENABLED="true"
ENCRYPTION_ACTIVE_KEY_ID="main-2026-06"
ENCRYPTION_KEYS_JSON='{"main-2026-06":"PASTE_KEY"}'
```

## Rotate to a new key

Add the new key to the keyring:

```env
ENCRYPTION_ACTIVE_KEY_ID="main-2026-09"
ENCRYPTION_KEYS_JSON='{
  "main-2026-06":"OLD_KEY",
  "main-2026-09":"NEW_KEY"
}'
```

Dry run:

```bash
SECRET_ROTATION_DRY_RUN=true npm run secrets:rotate
```

Rotate:

```bash
npm run secrets:rotate
```

Confirm System Health shows zero unrotated secrets.

Keep old keys in the keyring until backups older than the rotation window are no longer needed.

## Do not remove old keys immediately

Old database backups may contain secrets encrypted with older keys. Removing old keys too early can make restored backups unusable.
