import { prisma } from "@/lib/prisma";
import {
  decryptSecret,
  encryptSecret,
  getActiveEncryptionKeyId,
  needsSecretRotation,
} from "@/server/security/secret-encryption";

export async function getWhatsAppAccessToken({
  companyId,
}: {
  companyId: string;
}) {
  const account = await prisma.whatsAppAccount.findFirst({
    where: {
      companyId,
      status: "CONNECTED",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      accessToken: true,
    },
  });

  if (!account?.accessToken) {
    throw new Error("WhatsApp access token is not configured");
  }

  return decryptSecret({
    encrypted: account.accessToken,
    purpose: "whatsapp_access_token",
  });
}

export async function encryptAndStoreWhatsAppAccessToken({
  whatsAppAccountId,
  accessToken,
}: {
  whatsAppAccountId: string;
  accessToken: string;
}) {
  return prisma.whatsAppAccount.update({
    where: {
      id: whatsAppAccountId,
    },
    data: {
      accessToken: encryptSecret({
        plaintext: accessToken,
        purpose: "whatsapp_access_token",
      }),
      accessTokenKeyId: getActiveEncryptionKeyId(),
      accessTokenEncryptedAt: new Date(),
    },
  });
}

export async function rotateWhatsAppAccessTokenSecret({
  whatsAppAccountId,
}: {
  whatsAppAccountId: string;
}) {
  const account = await prisma.whatsAppAccount.findUnique({
    where: {
      id: whatsAppAccountId,
    },
    select: {
      id: true,
      accessToken: true,
    },
  });

  if (!account?.accessToken || !needsSecretRotation(account.accessToken)) {
    return {
      rotated: false,
    };
  }

  const plaintext = decryptSecret({
    encrypted: account.accessToken,
    purpose: "whatsapp_access_token",
  });

  await encryptAndStoreWhatsAppAccessToken({
    whatsAppAccountId,
    accessToken: plaintext,
  });

  return {
    rotated: true,
  };
}
