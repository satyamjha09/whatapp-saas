import "dotenv/config";
import { Worker } from "bullmq";
import { decryptText } from "@/lib/encryption";
import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { redisConnection } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppTemplateMessage } from "@/lib/whatsapp";
import { enqueueDeveloperMessageStatusWebhook } from "@/server/services/developer-webhook.service";
import { refundWalletForMessage } from "@/server/services/wallet.service";
import type { SendMessageJobData } from "@/lib/queue";

async function updateCampaignCompletion(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: {
      id: campaignId,
    },
    include: {
      contacts: true,
    },
  });

  if (!campaign) {
    return;
  }

  const allFinished = campaign.contacts.every((contact) =>
    ["SENT", "DELIVERED", "READ", "FAILED", "SKIPPED"].includes(
      contact.status,
    ),
  );

  if (!allFinished) {
    return;
  }

  const hasFailed = campaign.contacts.some(
    (contact) => contact.status === "FAILED",
  );

  await prisma.campaign.update({
    where: {
      id: campaign.id,
    },
    data: {
      status: hasFailed ? "FAILED" : "COMPLETED",
    },
  });
}

async function markCampaignMessageSent(message: {
  campaignContactId: string | null;
  campaignId: string | null;
}) {
  if (message.campaignContactId) {
    await prisma.campaignContact.update({
      where: {
        id: message.campaignContactId,
      },
      data: {
        status: "SENT",
      },
    });
  }

  if (message.campaignId) {
    await prisma.campaign.update({
      where: {
        id: message.campaignId,
      },
      data: {
        sentCount: {
          increment: 1,
        },
      },
    });

    await updateCampaignCompletion(message.campaignId);
  }
}

async function markMessageAsFailed(
  messageId: string,
  companyId: string,
  reason: string,
) {
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      companyId,
    },
  });

  if (!message || message.status === "FAILED") {
    return;
  }

  await prisma.message.update({
    where: {
      id: message.id,
    },
    data: {
      status: "FAILED",
      events: {
        create: {
          companyId,
          status: "FAILED",
          raw: {
            source: "worker",
            reason,
          },
        },
      },
    },
  });

  await enqueueDeveloperMessageStatusWebhook(companyId, message.id);

  await refundWalletForMessage(
    companyId,
    MESSAGE_PRICE_PAISE,
    "Message sending failed refund",
    message.id,
  );

  if (message.campaignContactId) {
    await prisma.campaignContact.update({
      where: {
        id: message.campaignContactId,
      },
      data: {
        status: "FAILED",
      },
    });
  }

  if (message.campaignId) {
    await prisma.campaign.update({
      where: {
        id: message.campaignId,
      },
      data: {
        failedCount: {
          increment: 1,
        },
      },
    });

    await updateCampaignCompletion(message.campaignId);
  }
}

const worker = new Worker<SendMessageJobData>(
  "message-queue",
  async (job) => {
    const { messageId, companyId } = job.data;

    try {
      console.log("Processing message job:", job.id, messageId);

      const message = await prisma.message.findFirst({
        where: {
          id: messageId,
          companyId,
        },
        include: {
          template: true,
        },
      });

      if (!message) {
        throw new Error("Message not found");
      }

      if (!message.template) {
        throw new Error("Template not found for message");
      }

      const whatsAppAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          companyId,
          status: "CONNECTED",
        },
        include: {
          phoneNumbers: true,
        },
      });

      const phoneNumber = whatsAppAccount?.phoneNumbers[0];

      const hasCompanyWhatsAppCredentials =
        Boolean(whatsAppAccount?.accessToken) &&
        Boolean(phoneNumber?.phoneNumberId);

      await prisma.message.update({
        where: {
          id: message.id,
        },
        data: {
          status: "SENDING",
          events: {
            create: {
              companyId,
              status: "SENDING",
              raw: {
                source: "worker",
                jobId: job.id,
              },
            },
          },
        },
      });

      if (!hasCompanyWhatsAppCredentials) {
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const fakeMetaMessageId = `dev_meta_${message.id}`;

        await prisma.message.update({
          where: {
            id: message.id,
          },
          data: {
            status: "SENT",
            metaMessageId: fakeMetaMessageId,
            events: {
              create: {
                companyId,
                status: "SENT",
                raw: {
                  source: "worker",
                  mode: "development_simulation",
                  jobId: job.id,
                  metaMessageId: fakeMetaMessageId,
                },
              },
            },
          },
        });

        await enqueueDeveloperMessageStatusWebhook(companyId, message.id);

        await markCampaignMessageSent(message);

        console.log("Message sent in dev mode:", message.id);
        return;
      }

      const decryptedAccessToken = decryptText(whatsAppAccount!.accessToken!);

      const result = await sendWhatsAppTemplateMessage({
        accessToken: decryptedAccessToken,
        phoneNumberId: phoneNumber!.phoneNumberId!,
        to: message.toPhoneNumber,
        templateName: message.template.name,
        languageCode: message.template.language,
        variables: message.variables,
      });

      await prisma.message.update({
        where: {
          id: message.id,
        },
        data: {
          status: "SENT",
          metaMessageId: result.metaMessageId,
          events: {
            create: {
              companyId,
              status: "SENT",
              raw: {
                source: "worker",
                mode: "meta_cloud_api",
                jobId: job.id,
                metaResponse: result.raw,
              },
            },
          },
        },
      });

      await enqueueDeveloperMessageStatusWebhook(companyId, message.id);

      await markCampaignMessageSent(message);

      console.log("Message sent using Meta API:", message.id);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Unknown worker error";

      console.error("MESSAGE_WORKER_PROCESSING_ERROR:", reason);

      await markMessageAsFailed(messageId, companyId, reason);

      throw error;
    }
  },
  {
    connection: redisConnection,
  },
);

worker.on("completed", (job) => {
  console.log(`Job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Job failed: ${job?.id}`, error);
});

console.log("Message worker is running...");
