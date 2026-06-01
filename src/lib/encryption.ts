import crypto from "crypto";

const algorithm = "aes-256-gcm";

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    throw new Error("ENCRYPTION_KEY is not defined");
  }

  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be exactly 32 characters");
  }

  return Buffer.from(key, "utf8");
}

export function encryptText(text: string) {
  const key = getEncryptionKey();

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decryptText(encryptedText: string) {
  const key = getEncryptionKey();

  const [ivHex, authTagHex, encryptedHex] = encryptedText.split(":");

  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Invalid encrypted text format");
  }

  const decipher = crypto.createDecipheriv(
    algorithm,
    key,
    Buffer.from(ivHex, "hex"),
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
