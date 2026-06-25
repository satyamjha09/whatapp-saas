import "dotenv/config";
import { UnrecoverableError, Worker } from "bullmq";
import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { DEFAULT_MESSAGE_JOB_ATTEMPTS } from "@/lib/queue";
import { getRedisConnection } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import {
  sendWhatsAppTemplateMessage,
  sendWhatsAppTextMessage,
} from "@/lib/whatsapp";
import { enqueueDeveloperMessageStatusWebhook } from "@/server/services/developer-webhook.service";
import { publishCampaignDeveloperWebhookEvent } from "@/server/services/developer-webhook-event-publisher.service";
import { updateBulkMessageRecipientTracking } from "@/server/services/bulk-message-tracking.service";
import { refundWalletForMessage } from "@/server/services/wallet.service";
import type { SendMessageJobData } from "@/lib/queue";
import {
  isSystemMaintenanceModeEnabled,
  SystemMaintenanceModeError,
} from "@/server/services/system-maintenance-mode.service";
import { getWhatsAppAccessToken } from "@/server/services/whatsapp-secret.service";
import { createWorkerHeartbeat } from "@/server/services/worker-heartbeat.service";

const heartbeat = createWorkerHeartbeat({
  workerName: process.env.WORKER_HEARTBEAT_NAME ?? "message-worker",
});

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

  const updatedCampaign = await prisma.campaign.update({
    where: {
      id: campaign.id,
    },
    data: {
      status: hasFailed ? "FAILED" : "COMPLETED",
    },
  });

  await publishCampaignDeveloperWebhookEvent({
    companyId: updatedCampaign.companyId,
    campaign: updatedCampaign,
    operation: "completed",
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

  if (
    !message ||
    message.status === "FAILED" ||
    message.status === "CANCELED"
  ) {
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

  await updateBulkMessageRecipientTracking(message.id, "FAILED", reason);
  await enqueueDeveloperMessageStatusWebhook(companyId, message.id);

  if (message.templateId) {
    await refundWalletForMessage(
      companyId,
      MESSAGE_PRICE_PAISE,
      "Message sending failed refund",
      message.id,
    );
  }

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

async function markMessageForRetry(
  messageId: string,
  companyId: string,
  reason: string,
  attemptNumber: number,
  maxAttempts: number,
) {
  await prisma.message.updateMany({
    where: {
      id: messageId,
      companyId,
      status: "SENDING",
    },
    data: {
      status: "RETRY_PENDING",
    },
  });

  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      companyId,
      status: "RETRY_PENDING",
    },
    select: {
      id: true,
    },
  });

  if (!message) {
    return;
  }

  await prisma.messageEvent.create({
    data: {
      companyId,
      messageId,
      status: "RETRY_PENDING",
      raw: {
        source: "worker",
        reason,
        attemptNumber,
        maxAttempts,
      },
    },
  });
}

function getMaxAttempts(jobAttempts?: number) {
  return jobAttempts && jobAttempts > 0
    ? jobAttempts
    : DEFAULT_MESSAGE_JOB_ATTEMPTS;
}

function isFinalAttempt(attemptsMade: number, maxAttempts: number) {
  return attemptsMade + 1 >= maxAttempts;
}

function getHttpStatus(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "status" in error.response &&
    typeof error.response.status === "number"
  ) {
    return error.response.status;
  }

  return null;
}

function isPermanentMessageSendError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "Message not found") {
    return true;
  }

  const httpStatus = getHttpStatus(error);

  if (!httpStatus) {
    return false;
  }

  if (httpStatus === 429 || httpStatus >= 500) {
    return false;
  }

  return httpStatus >= 400 && httpStatus < 500;
}

const worker = new Worker<SendMessageJobData>(
  "message-queue",
  async (job) => {
    const { messageId, companyId } = job.data;

    try {
      console.log("Processing message job:", job.id, messageId);

      if (await isSystemMaintenanceModeEnabled()) {
        throw new SystemMaintenanceModeError(
          "System maintenance mode is enabled. Message send will retry later.",
        );
      }

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

      if (message.status === "CANCELED") {
        return;
      }

      const claimedForSending = await prisma.$transaction(async (tx) => {
        const bulkRecipient = await tx.bulkMessageBatchRecipient.findUnique({
          where: { messageId: message.id },
          select: { batchId: true },
        });

        if (bulkRecipient) {
          const scheduledBatchClaim = await tx.bulkMessageBatch.updateMany({
            where: {
              id: bulkRecipient.batchId,
              status: "SCHEDULED",
            },
            data: { status: "QUEUED" },
          });

          if (scheduledBatchClaim.count === 0) {
            const currentBatch = await tx.bulkMessageBatch.findUnique({
              where: { id: bulkRecipient.batchId },
              select: { status: true },
            });

            if (currentBatch?.status === "CANCELED") return false;
          }
        }

        const messageClaim = await tx.message.updateMany({
          where: {
            id: message.id,
            companyId,
            status: {
              in: ["QUEUED", "RETRY_PENDING"],
            },
          },
          data: { status: "SENDING" },
        });

        if (messageClaim.count !== 1) return false;

        await tx.messageEvent.create({
          data: {
            companyId,
            messageId: message.id,
            status: "SENDING",
            raw: {
              source: "worker",
              jobId: job.id,
            },
          },
        });

        return true;
      });

      if (!claimedForSending) return;

      await updateBulkMessageRecipientTracking(message.id, "SENDING");

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

        await updateBulkMessageRecipientTracking(message.id, "SENT");
        await enqueueDeveloperMessageStatusWebhook(companyId, message.id);

        await markCampaignMessageSent(message);

        console.log("Message sent in dev mode:", message.id);
        return;
      }

      const decryptedAccessToken = await getWhatsAppAccessToken({ companyId });

      const result = message.template
        ? await sendWhatsAppTemplateMessage({
            accessToken: decryptedAccessToken,
            phoneNumberId: phoneNumber!.phoneNumberId!,
            to: message.toPhoneNumber,
            templateName: message.template.name,
            languageCode: message.template.language,
            variables: message.variables,
          })
        : await sendWhatsAppTextMessage({
            accessToken: decryptedAccessToken,
            phoneNumberId: phoneNumber!.phoneNumberId!,
            to: message.toPhoneNumber,
            body: message.body,
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

      await updateBulkMessageRecipientTracking(message.id, "SENT");
      await enqueueDeveloperMessageStatusWebhook(companyId, message.id);

      await markCampaignMessageSent(message);

      console.log(
        message.template
          ? "Template message sent using Meta API:"
          : "Session reply sent using Meta API:",
        message.id,
      );
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Unknown worker error";

      console.error("MESSAGE_WORKER_PROCESSING_ERROR:", reason);

      if (error instanceof SystemMaintenanceModeError) {
        throw error;
      }

      const maxAttempts = getMaxAttempts(job.opts.attempts);
      const permanentFailure = isPermanentMessageSendError(error);
      const finalAttempt = isFinalAttempt(job.attemptsMade, maxAttempts);

      if (permanentFailure || finalAttempt) {
        await markMessageAsFailed(messageId, companyId, reason);

        if (permanentFailure && !finalAttempt) {
          throw new UnrecoverableError(reason);
        }

        throw error;
      }

      await markMessageForRetry(
        messageId,
        companyId,
        reason,
        job.attemptsMade + 1,
        maxAttempts,
      );

      throw error;
    }
  },
  {
    connection: getRedisConnection(),
  },
);

void heartbeat.start();

worker.on("completed", (job) => {
  console.log(`Job completed: ${job.id}`);
});

worker.on("failed", async (job, error) => {
  console.error(`Job failed: ${job?.id}`, error);
  await heartbeat.markError(error);
});

console.log("Message worker is running...");

async function shutdown() {
  await worker.close();
  await heartbeat.stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
