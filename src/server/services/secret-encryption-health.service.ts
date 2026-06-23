import { prisma } from "@/lib/prisma";
import {
  getActiveEncryptionKeyId,
  getSecretEncryptionSummary,
  isSecretEncryptedV2,
} from "@/server/security/secret-encryption";

export async function getSecretEncryptionHealth() {
  const summary = getSecretEncryptionSummary();
  const activeKeyId = getActiveEncryptionKeyId();

  const [
    whatsappTotal,
    whatsappEncryptedV2,
    whatsappActiveKey,
    developerWebhookTotal,
    developerWebhookActiveKey,
  ] = await Promise.all([
    prisma.whatsAppAccount.count({
      where: {
        accessToken: {
          not: null,
        },
      },
    }),

    prisma.whatsAppAccount.findMany({
      where: {
        accessToken: {
          not: null,
        },
      },
      select: {
        accessToken: true,
      },
    }).then((rows) =>
      rows.filter((row) => isSecretEncryptedV2(row.accessToken)).length,
    ),

    prisma.whatsAppAccount.count({
      where: {
        accessToken: {
          not: null,
        },
        accessTokenKeyId: activeKeyId,
      },
    }),

    prisma.developerWebhookEndpoint.count(),

    prisma.developerWebhookEndpoint.count({
      where: {
        signingSecretKeyId: activeKeyId,
      },
    }),
  ]);

  const unrotatedWhatsApp = Math.max(whatsappTotal - whatsappActiveKey, 0);
  const unrotatedDeveloperWebhooks = Math.max(
    developerWebhookTotal - developerWebhookActiveKey,
    0,
  );

  return {
    ...summary,
    isHealthy:
      summary.enabled &&
      summary.activeKeyConfigured &&
      unrotatedWhatsApp === 0 &&
      unrotatedDeveloperWebhooks === 0,
    activeKeyId,
    whatsapp: {
      total: whatsappTotal,
      encryptedV2: whatsappEncryptedV2,
      activeKey: whatsappActiveKey,
      unrotated: unrotatedWhatsApp,
    },
    developerWebhooks: {
      total: developerWebhookTotal,
      activeKey: developerWebhookActiveKey,
      unrotated: unrotatedDeveloperWebhooks,
    },
  };
}
