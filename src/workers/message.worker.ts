import "dotenv/config";
import { Worker } from "bullmq";
import { decryptText } from "@/lib/encryption";
import { redisConnection } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppTemplateMessage } from "@/lib/whatsapp";
import type { SendMessageJobData } from "@/lib/queue";

const worker = new Worker<SendMessageJobData>(
  "message-queue",
  async (job) => {
    const { messageId, companyId } = job.data;

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

    console.log("Message sent using Meta API:", message.id);
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
