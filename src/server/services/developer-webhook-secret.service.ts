import { prisma } from "@/lib/prisma";
import {
  decryptSecret,
  encryptSecret,
  getActiveEncryptionKeyId,
  needsSecretRotation,
} from "@/server/security/secret-encryption";

export function encryptDeveloperWebhookSigningSecret(secret: string) {
  return encryptSecret({
    plaintext: secret,
    purpose: "developer_webhook_signing_secret",
  });
}

export function decryptDeveloperWebhookSigningSecret(encrypted: string) {
  return decryptSecret({
    encrypted,
    purpose: "developer_webhook_signing_secret",
  });
}

export async function rotateDeveloperWebhookSigningSecretEncryption({
  endpointId,
}: {
  endpointId: string;
}) {
  const endpoint = await prisma.developerWebhookEndpoint.findUnique({
    where: {
      id: endpointId,
    },
    select: {
      id: true,
      signingSecretEncrypted: true,
    },
  });

  if (
    !endpoint?.signingSecretEncrypted ||
    !needsSecretRotation(endpoint.signingSecretEncrypted)
  ) {
    return {
      rotated: false,
    };
  }

  const plaintext = decryptDeveloperWebhookSigningSecret(
    endpoint.signingSecretEncrypted,
  );

  await prisma.developerWebhookEndpoint.update({
    where: {
      id: endpoint.id,
    },
    data: {
      signingSecretEncrypted: encryptDeveloperWebhookSigningSecret(plaintext),
      signingSecretKeyId: getActiveEncryptionKeyId(),
      signingSecretEncryptedAt: new Date(),
    },
  });

  return {
    rotated: true,
  };
}
