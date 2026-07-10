import crypto from "node:crypto";
import { decryptText } from "@/lib/encryption";

const SECRET_PREFIX = "tksec";
const SECRET_VERSION = "v2";

export type SecretPurpose =
  | "whatsapp_access_token"
  | "developer_webhook_signing_secret"
  | "whatsapp_flow_token"
  | "generic_secret";

type Keyring = Record<string, Buffer>;

export class SecretEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretEncryptionError";
  }
}

function parseKeyValue(value: string) {
  const trimmed = value.trim();

  try {
    const base64url = Buffer.from(trimmed, "base64url");
    if (base64url.length === 32) return base64url;
  } catch {}

  try {
    const base64 = Buffer.from(trimmed, "base64");
    if (base64.length === 32) return base64;
  } catch {}

  const utf8 = Buffer.from(trimmed, "utf8");
  if (utf8.length === 32) return utf8;

  throw new SecretEncryptionError(
    "Encryption key must decode to exactly 32 bytes",
  );
}

export function getEncryptionKeyring(): Keyring {
  const keyringRaw = process.env.ENCRYPTION_KEYS_JSON;

  const keyring: Keyring = {};

  if (keyringRaw) {
    let parsed: unknown;

    try {
      parsed = JSON.parse(keyringRaw);
    } catch {
      throw new SecretEncryptionError("ENCRYPTION_KEYS_JSON must be valid JSON");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new SecretEncryptionError("ENCRYPTION_KEYS_JSON must be an object");
    }

    for (const [keyId, value] of Object.entries(parsed)) {
      if (typeof value !== "string") {
        throw new SecretEncryptionError(`Encryption key ${keyId} must be a string`);
      }

      keyring[keyId] = parseKeyValue(value);
    }
  }

  /*
    Backward compatibility: old installs used ENCRYPTION_KEY.
    Keep it available for decrypting old values.
  */
  if (process.env.ENCRYPTION_KEY && !keyring.legacy) {
    keyring.legacy = parseKeyValue(process.env.ENCRYPTION_KEY);
  }

  return keyring;
}

export function getActiveEncryptionKeyId() {
  const activeKeyId = process.env.ENCRYPTION_ACTIVE_KEY_ID;

  if (activeKeyId) {
    return activeKeyId;
  }

  if (process.env.ENCRYPTION_KEY) {
    return "legacy";
  }

  throw new SecretEncryptionError("ENCRYPTION_ACTIVE_KEY_ID is required");
}

function getActiveKey() {
  const keyring = getEncryptionKeyring();
  const activeKeyId = getActiveEncryptionKeyId();
  const key = keyring[activeKeyId];

  if (!key) {
    throw new SecretEncryptionError(
      `Active encryption key is missing from keyring: ${activeKeyId}`,
    );
  }

  return {
    keyId: activeKeyId,
    key,
  };
}

function getKeyById(keyId: string) {
  const key = getEncryptionKeyring()[keyId];

  if (!key) {
    throw new SecretEncryptionError(`Encryption key not found: ${keyId}`);
  }

  return key;
}

function getAad(purpose: SecretPurpose) {
  return Buffer.from(`tallykonnect:${SECRET_VERSION}:${purpose}`, "utf8");
}

export function isSecretEncryptedV2(value: string | null | undefined) {
  return Boolean(value?.startsWith(`${SECRET_PREFIX}:${SECRET_VERSION}:`));
}

export function getEncryptedSecretKeyId(value: string | null | undefined) {
  if (!isSecretEncryptedV2(value)) return null;

  const parts = value!.split(":");
  return parts[2] || null;
}

export function encryptSecret({
  plaintext,
  purpose,
}: {
  plaintext: string;
  purpose: SecretPurpose;
}) {
  if (!plaintext) {
    throw new SecretEncryptionError("Cannot encrypt empty secret");
  }

  const { keyId, key } = getActiveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  cipher.setAAD(getAad(purpose));

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    SECRET_PREFIX,
    SECRET_VERSION,
    keyId,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptSecret({
  encrypted,
  purpose,
}: {
  encrypted: string;
  purpose: SecretPurpose;
}) {
  if (!encrypted) {
    throw new SecretEncryptionError("Cannot decrypt empty secret");
  }

  if (!isSecretEncryptedV2(encrypted)) {
    if (process.env.ENCRYPTION_ALLOW_LEGACY_PLAINTEXT_MIGRATION === "true") {
      try {
        return decryptText(encrypted);
      } catch {
        return encrypted;
      }
    }

    throw new SecretEncryptionError("Secret is not encrypted with v2 format");
  }

  const [, version, keyId, ivBase64, tagBase64, ciphertextBase64] =
    encrypted.split(":");

  if (
    version !== SECRET_VERSION ||
    !keyId ||
    !ivBase64 ||
    !tagBase64 ||
    !ciphertextBase64
  ) {
    throw new SecretEncryptionError("Invalid encrypted secret format");
  }

  const key = getKeyById(keyId);
  const iv = Buffer.from(ivBase64, "base64url");
  const authTag = Buffer.from(tagBase64, "base64url");
  const ciphertext = Buffer.from(ciphertextBase64, "base64url");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(getAad(purpose));
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function needsSecretRotation(value: string | null | undefined) {
  if (!value) return false;

  const currentKeyId = getEncryptedSecretKeyId(value);

  if (!currentKeyId) return true;

  return currentKeyId !== getActiveEncryptionKeyId();
}

export function getSecretEncryptionSummary() {
  const keyring = getEncryptionKeyring();
  const activeKeyId = getActiveEncryptionKeyId();

  return {
    enabled: process.env.SECRET_ENCRYPTION_V2_ENABLED !== "false",
    activeKeyId,
    keyCount: Object.keys(keyring).length,
    activeKeyConfigured: Boolean(keyring[activeKeyId]),
    legacyKeyConfigured: Boolean(keyring.legacy),
    keyIds: Object.keys(keyring),
  };
}
