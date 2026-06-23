import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getSecretEncryptionSummary } from "@/server/security/secret-encryption";
import { rotateDeveloperWebhookSigningSecretEncryption } from "@/server/services/developer-webhook-secret.service";
import { rotateWhatsAppAccessTokenSecret } from "@/server/services/whatsapp-secret.service";
import { logger } from "@/server/utils/safe-logger";

const dryRun = process.env.SECRET_ROTATION_DRY_RUN === "true";

async function rotateWhatsAppAccounts() {
  const accounts = await prisma.whatsAppAccount.findMany({
    where: {
      accessToken: {
        not: null,
      },
    },
    select: {
      id: true,
      companyId: true,
      accessTokenKeyId: true,
    },
  });

  let rotated = 0;
  let skipped = 0;
  let failed = 0;

  for (const account of accounts) {
    try {
      if (dryRun) {
        logger.info("Would inspect WhatsApp account secret", {
          accountId: account.id,
          companyId: account.companyId,
          accessTokenKeyId: account.accessTokenKeyId,
        });
        skipped += 1;
        continue;
      }

      const result = await rotateWhatsAppAccessTokenSecret({
        whatsAppAccountId: account.id,
      });

      if (result.rotated) rotated += 1;
      else skipped += 1;
    } catch (error) {
      failed += 1;
      logger.error("WhatsApp access token rotation failed", {
        error,
        accountId: account.id,
        companyId: account.companyId,
      });
    }
  }

  return {
    checked: accounts.length,
    rotated,
    skipped,
    failed,
  };
}

async function rotateDeveloperWebhookEndpoints() {
  const endpoints = await prisma.developerWebhookEndpoint.findMany({
    select: {
      id: true,
      companyId: true,
      signingSecretKeyId: true,
    },
  });

  let rotated = 0;
  let skipped = 0;
  let failed = 0;

  for (const endpoint of endpoints) {
    try {
      if (dryRun) {
        logger.info("Would inspect developer webhook secret", {
          endpointId: endpoint.id,
          companyId: endpoint.companyId,
          signingSecretKeyId: endpoint.signingSecretKeyId,
        });
        skipped += 1;
        continue;
      }

      const result = await rotateDeveloperWebhookSigningSecretEncryption({
        endpointId: endpoint.id,
      });

      if (result.rotated) rotated += 1;
      else skipped += 1;
    } catch (error) {
      failed += 1;
      logger.error("Developer webhook secret rotation failed", {
        error,
        endpointId: endpoint.id,
        companyId: endpoint.companyId,
      });
    }
  }

  return {
    checked: endpoints.length,
    rotated,
    skipped,
    failed,
  };
}

async function main() {
  const summary = getSecretEncryptionSummary();

  if (!summary.enabled) {
    throw new Error("SECRET_ENCRYPTION_V2_ENABLED is false");
  }

  if (!summary.activeKeyConfigured) {
    throw new Error(`Active encryption key is missing: ${summary.activeKeyId}`);
  }

  logger.info("Starting secret rotation", {
    dryRun,
    activeKeyId: summary.activeKeyId,
    keyCount: summary.keyCount,
  });

  const [whatsapp, webhooks] = await Promise.all([
    rotateWhatsAppAccounts(),
    rotateDeveloperWebhookEndpoints(),
  ]);

  logger.info("Secret rotation completed", {
    dryRun,
    whatsapp,
    webhooks,
  });

  if (whatsapp.failed > 0 || webhooks.failed > 0) {
    process.exitCode = 1;
  }
}

void main()
  .catch((error) => {
    logger.error("Secret rotation script failed", {
      error,
    });

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
