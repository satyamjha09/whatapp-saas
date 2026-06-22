import crypto from "crypto";
import {
  decryptSecret,
  encryptSecret,
} from "@/server/utils/secret-encryption";

export function generateDeveloperWebhookSigningSecret() {
  return `tk_whsec_${crypto.randomBytes(32).toString("hex")}`;
}

export function getSecretPreview(secret: string) {
  return `${secret.slice(0, 12)}...${secret.slice(-6)}`;
}

export function encryptDeveloperWebhookSigningSecret(secret: string) {
  return encryptSecret(secret);
}

export function decryptDeveloperWebhookSigningSecret(encryptedSecret: string) {
  return decryptSecret(encryptedSecret);
}

export function createDeveloperWebhookSignature({
  payload,
  secret,
  timestamp,
}: {
  payload: string;
  secret: string;
  timestamp: number;
}) {
  const signedPayload = `${timestamp}.${payload}`;

  return crypto
    .createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");
}

export function buildDeveloperWebhookSignatureHeader({
  payload,
  secret,
}: {
  payload: string;
  secret: string;
}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createDeveloperWebhookSignature({
    payload,
    secret,
    timestamp,
  });

  return {
    timestamp,
    signatureHeader: `t=${timestamp},v1=${signature}`,
  };
}
