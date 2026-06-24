import crypto from "node:crypto";

function getSecret() {
  const secret = process.env.PUBLIC_PRIVACY_TOKEN_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("PUBLIC_PRIVACY_TOKEN_SECRET must be at least 32 characters");
  }

  return secret;
}

export function normalizePrivacyEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPrivacyEmail(email: string) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(normalizePrivacyEmail(email))
    .digest("hex");
}

export function createPublicPrivacyToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashPublicPrivacyToken(token: string) {
  return crypto.createHmac("sha256", getSecret()).update(token).digest("hex");
}
