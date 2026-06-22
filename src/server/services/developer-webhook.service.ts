import { prisma } from "@/lib/prisma";
import { getDeveloperWebhookQueue } from "@/lib/queue";
import type { Prisma } from "@/generated/prisma/client";
import { DEVELOPER_WEBHOOK_PAYLOAD_VERSION } from "@/server/config/developer-webhook-events";
import { CreateDeveloperWebhookEndpointInput } from "@/server/validators/developer-webhook.validator";
import {
  assertCompanyFeature,
  hasCompanyFeature,
} from "@/server/services/feature-gate.service";
import {
  encryptDeveloperWebhookSigningSecret,
  generateDeveloperWebhookSigningSecret,
  getSecretPreview,
} from "@/server/services/developer-webhook-signature.service";
import { publishMessageDeveloperWebhookEvent } from "@/server/services/developer-webhook-event-publisher.service";

export async function getDeveloperWebhookEndpointsByCompany(
  companyId: string,
) {
  return prisma.developerWebhookEndpoint.findMany({
    where: {
      companyId,
    },
    select: {
      id: true,
      companyId: true,
      name: true,
      url: true,
      events: true,
      payloadVersion: true,
      secretPrefix: true,
      secretLast4: true,
      signingSecretPreview: true,
      signingSecretRotatedAt: true,
      status: true,
      consecutiveFailureCount: true,
      lastSuccessAt: true,
      lastFailureAt: true,
      autoDisabledAt: true,
      autoDisabledReason: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function createDeveloperWebhookEndpointForCompany(
  companyId: string,
  input: CreateDeveloperWebhookEndpointInput,
) {
  await assertCompanyFeature(companyId, "DEVELOPER_WEBHOOKS");
  const signingSecret = generateDeveloperWebhookSigningSecret();

  const endpoint = await prisma.developerWebhookEndpoint.create({
    data: {
      companyId,
      name: input.name,
      url: input.url,
      events: input.events,
      payloadVersion: input.payloadVersion,
      signingSecretEncrypted:
        encryptDeveloperWebhookSigningSecret(signingSecret),
      secretPrefix: signingSecret.slice(0, 10),
      secretLast4: signingSecret.slice(-4),
      signingSecretPreview: getSecretPreview(signingSecret),
      signingSecretRotatedAt: new Date(),
      status: "ACTIVE",
    },
    select: {
      id: true,
      companyId: true,
      name: true,
      url: true,
      events: true,
      payloadVersion: true,
      secretPrefix: true,
      secretLast4: true,
      signingSecretPreview: true,
      signingSecretRotatedAt: true,
      status: true,
      consecutiveFailureCount: true,
      lastSuccessAt: true,
      lastFailureAt: true,
      autoDisabledAt: true,
      autoDisabledReason: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    endpoint,
    signingSecret,
  };
}

export async function revokeDeveloperWebhookEndpoint(
  companyId: string,
  endpointId: string,
) {
  const endpoint = await prisma.developerWebhookEndpoint.findFirst({
    where: {
      id: endpointId,
      companyId,
    },
  });

  if (!endpoint) {
    throw new Error("Webhook endpoint not found");
  }

  if (endpoint.status === "REVOKED") {
    throw new Error("Webhook endpoint is already revoked");
  }

  return prisma.developerWebhookEndpoint.update({
    where: {
      id: endpoint.id,
    },
    data: {
      status: "REVOKED",
    },
    select: {
      id: true,
      companyId: true,
      name: true,
      url: true,
      events: true,
      payloadVersion: true,
      secretPrefix: true,
      secretLast4: true,
      signingSecretPreview: true,
      signingSecretRotatedAt: true,
      status: true,
      consecutiveFailureCount: true,
      lastSuccessAt: true,
      lastFailureAt: true,
      autoDisabledAt: true,
      autoDisabledReason: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getActiveDeveloperWebhookEndpoints({
  companyId,
  eventType,
}: {
  companyId: string;
  eventType: string;
}) {
  return prisma.developerWebhookEndpoint.findMany({
    where: {
      companyId,
      status: "ACTIVE",
      OR: [
        {
          events: {
            has: eventType,
          },
        },
        {
          events: {
            isEmpty: true,
          },
        },
      ],
    },
  });
}

type EnqueueDeveloperWebhookInput = {
  companyId: string;
  eventType: string;
  payload: Record<string, unknown>;
  outboxEventId?: string;
};

export async function enqueueDeveloperWebhookDeliveries(
  input: EnqueueDeveloperWebhookInput,
) {
  if (!(await hasCompanyFeature(input.companyId, "DEVELOPER_WEBHOOKS"))) {
    return [];
  }

  const endpoints = await getActiveDeveloperWebhookEndpoints({
    companyId: input.companyId,
    eventType: input.eventType,
  });

  if (endpoints.length === 0) {
    return [];
  }

  const deliveries = [];

  for (const endpoint of endpoints) {
    const payload = {
      ...input.payload,
      type: input.eventType,
      version: endpoint.payloadVersion ?? DEVELOPER_WEBHOOK_PAYLOAD_VERSION,
      createdAt:
        typeof input.payload.createdAt === "string"
          ? input.payload.createdAt
          : new Date().toISOString(),
    };
    const delivery = await prisma.developerWebhookDelivery.create({
      data: {
        companyId: input.companyId,
        endpointId: endpoint.id,
        outboxEventId: input.outboxEventId ?? null,
        eventType: input.eventType,
        payload: payload as Prisma.InputJsonValue,
        status: "PENDING",
      },
    });

    await getDeveloperWebhookQueue().add(
      "deliver-developer-webhook",
      {
        deliveryId: delivery.id,
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
      },
    );

    deliveries.push(delivery);
  }

  return deliveries;
}

export async function enqueueDeveloperMessageStatusWebhook(
  companyId: string,
  messageId: string,
) {
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      companyId,
    },
    include: {
      contact: true,
      template: true,
    },
  });

  if (!message) {
    return [];
  }

  return publishMessageDeveloperWebhookEvent({
    companyId,
    message,
  });
}

export async function sendTestDeveloperWebhook(
  companyId: string,
  endpointId: string,
) {
  await assertCompanyFeature(companyId, "DEVELOPER_WEBHOOKS");
  const endpoint = await prisma.developerWebhookEndpoint.findFirst({
    where: {
      id: endpointId,
      companyId,
    },
  });

  if (!endpoint) {
    throw new Error("Webhook endpoint not found");
  }

  if (endpoint.status !== "ACTIVE") {
    throw new Error("Webhook endpoint is not active");
  }

  const testEventType =
    endpoint.events.length > 0 ? endpoint.events[0] : "message.sent";

  const delivery = await prisma.developerWebhookDelivery.create({
    data: {
      companyId,
      endpointId: endpoint.id,
      eventType: testEventType,
      status: "PENDING",
      payload: {
        id: `evt_test_${Date.now()}`,
        type: testEventType,
        version: endpoint.payloadVersion ?? DEVELOPER_WEBHOOK_PAYLOAD_VERSION,
        createdAt: new Date().toISOString(),
        data: {
          message: "This is a test webhook from your WhatsApp SaaS platform.",
          endpointId: endpoint.id,
          endpointName: endpoint.name,
        },
      } as Prisma.InputJsonValue,
    },
  });

  await getDeveloperWebhookQueue().add(
    "deliver-developer-webhook",
    {
      deliveryId: delivery.id,
    },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    },
  );

  return delivery;
}

export async function enqueueDeveloperInboundMessageWebhook(
  companyId: string,
  messageId: string,
) {
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      companyId,
    },
    include: {
      contact: true,
      template: true,
    },
  });

  if (!message) {
    return [];
  }

  return publishMessageDeveloperWebhookEvent({
    companyId,
    message,
  });
}
