import "dotenv/config";
import crypto from "crypto";
import axios from "axios";
import { Worker } from "bullmq";
import { decryptText } from "@/lib/encryption";
import { redisConnection } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import type { DeliverDeveloperWebhookJobData } from "@/lib/queue";

function createWebhookSignature({
  secret,
  timestamp,
  payload,
}: {
  secret: string;
  timestamp: string;
  payload: string;
}) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
}

const worker = new Worker<DeliverDeveloperWebhookJobData>(
  "developer-webhook-queue",
  async (job) => {
    const { deliveryId } = job.data;

    console.log("Processing developer webhook delivery:", deliveryId);

    const delivery = await prisma.developerWebhookDelivery.findUnique({
      where: {
        id: deliveryId,
      },
      include: {
        endpoint: true,
      },
    });

    if (!delivery) {
      throw new Error("Developer webhook delivery not found");
    }

    if (delivery.endpoint.status !== "ACTIVE") {
      await prisma.developerWebhookDelivery.update({
        where: {
          id: delivery.id,
        },
        data: {
          status: "FAILED",
          lastError: "Webhook endpoint is not active",
        },
      });

      return;
    }

    await prisma.developerWebhookDelivery.update({
      where: {
        id: delivery.id,
      },
      data: {
        status: "SENDING",
        attempts: {
          increment: 1,
        },
      },
    });

    const signingSecret = decryptText(delivery.endpoint.signingSecretEncrypted);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payloadString = JSON.stringify(delivery.payload);

    const signature = createWebhookSignature({
      secret: signingSecret,
      timestamp,
      payload: payloadString,
    });

    try {
      const response = await axios.post(delivery.endpoint.url, delivery.payload, {
        timeout: 10000,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "whatsapp-saas-webhooks/1.0",
          "x-wsaas-event": delivery.eventType,
          "x-wsaas-delivery-id": delivery.id,
          "x-wsaas-timestamp": timestamp,
          "x-wsaas-signature": `v1=${signature}`,
        },
      });

      await prisma.developerWebhookDelivery.update({
        where: {
          id: delivery.id,
        },
        data: {
          status: "DELIVERED",
          responseStatus: response.status,
          deliveredAt: new Date(),
          lastError: null,
        },
      });

      console.log("Developer webhook delivered:", delivery.id);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown webhook delivery error";

      await prisma.developerWebhookDelivery.update({
        where: {
          id: delivery.id,
        },
        data: {
          status: "FAILED",
          lastError: errorMessage,
        },
      });

      console.error("Developer webhook delivery failed:", errorMessage);

      throw error;
    }
  },
  {
    connection: redisConnection,
  },
);

worker.on("completed", (job) => {
  console.log(`Developer webhook job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Developer webhook job failed: ${job?.id}`, error.message);
});

console.log("Developer webhook worker is running...");
