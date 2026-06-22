import "dotenv/config";
import axios from "axios";
import { Worker } from "bullmq";
import { getRedisConnection } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import type { DeliverDeveloperWebhookJobData } from "@/lib/queue";
import {
  buildDeveloperWebhookSignatureHeader,
  decryptDeveloperWebhookSigningSecret,
} from "@/server/services/developer-webhook-signature.service";
import {
  markDeveloperWebhookDeliveryFailure,
  markDeveloperWebhookDeliverySuccess,
} from "@/server/services/developer-webhook-health.service";

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

    const payloadString = JSON.stringify(delivery.payload);
    const signingSecret = decryptDeveloperWebhookSigningSecret(
      delivery.endpoint.signingSecretEncrypted,
    );
    const { timestamp, signatureHeader } =
      buildDeveloperWebhookSignatureHeader({
        payload: payloadString,
        secret: signingSecret,
      });
    const startedAt = Date.now();

    try {
      const response = await axios.post(delivery.endpoint.url, payloadString, {
        timeout: 10000,
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "TallyKonnect-Webhooks/1.0",
          "X-TallyKonnect-Webhook-Id": delivery.id,
          "X-TallyKonnect-Webhook-Event": delivery.eventType,
          "X-TallyKonnect-Webhook-Timestamp": String(timestamp),
          "X-TallyKonnect-Webhook-Signature": signatureHeader,
        },
      });

      await prisma.developerWebhookDelivery.update({
        where: {
          id: delivery.id,
        },
        data: {
          status: "DELIVERED",
          responseStatus: response.status,
          responseBody:
            typeof response.data === "string"
              ? response.data.slice(0, 10_000)
              : JSON.stringify(response.data).slice(0, 10_000),
          durationMs: Date.now() - startedAt,
          deliveredAt: new Date(),
          lastError: null,
        },
      });

      await markDeveloperWebhookDeliverySuccess(delivery.endpoint.id);

      console.log("Developer webhook delivered:", delivery.id);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown webhook delivery error";
      const responseStatus =
        axios.isAxiosError(error) && error.response?.status
          ? error.response.status
          : undefined;
      const failureReason = responseStatus
        ? `Webhook returned HTTP ${responseStatus}`
        : errorMessage;
      const responseBody =
        axios.isAxiosError(error) && error.response?.data !== undefined
          ? typeof error.response.data === "string"
            ? error.response.data.slice(0, 10_000)
            : JSON.stringify(error.response.data).slice(0, 10_000)
          : null;

      await markDeveloperWebhookDeliveryFailure({
        endpointId: delivery.endpoint.id,
        reason: failureReason,
      });

      await prisma.developerWebhookDelivery.update({
        where: {
          id: delivery.id,
        },
        data: {
          status: "FAILED",
          responseStatus,
          responseBody,
          durationMs: Date.now() - startedAt,
          lastError: errorMessage,
        },
      });

      console.error("Developer webhook delivery failed:", errorMessage);

      throw error;
    }
  },
  {
    connection: getRedisConnection(),
  },
);

worker.on("completed", (job) => {
  console.log(`Developer webhook job completed: ${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`Developer webhook job failed: ${job?.id}`, error.message);
});

console.log("Developer webhook worker is running...");
