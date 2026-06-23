import crypto from "crypto";
import {
  decryptDeveloperWebhookSigningSecret as decryptDeveloperWebhookSigningSecretV2,
  encryptDeveloperWebhookSigningSecret as encryptDeveloperWebhookSigningSecretV2,
} from "@/server/services/developer-webhook-secret.service";

export function generateDeveloperWebhookSigningSecret() {
  return `tk_whsec_${crypto.randomBytes(32).toString("hex")}`;
}

export function getSecretPreview(secret: string) {
  return `${secret.slice(0, 12)}...${secret.slice(-6)}`;
}

export function encryptDeveloperWebhookSigningSecret(secret: string) {
  return encryptDeveloperWebhookSigningSecretV2(secret);
}

export function decryptDeveloperWebhookSigningSecret(encryptedSecret: string) {
  return decryptDeveloperWebhookSigningSecretV2(encryptedSecret);
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
