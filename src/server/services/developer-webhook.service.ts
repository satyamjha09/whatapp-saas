import crypto from "crypto";
import { encryptText } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import { getDeveloperWebhookQueue } from "@/lib/queue";
import type { Prisma } from "@/generated/prisma/client";
import { CreateDeveloperWebhookEndpointInput } from "@/server/validators/developer-webhook.validator";
import {
  assertCompanyFeature,
  hasCompanyFeature,
} from "@/server/services/feature-gate.service";

function generateSigningSecret() {
  return `whsec_${crypto.randomBytes(32).toString("hex")}`;
}

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
      secretPrefix: true,
      secretLast4: true,
      status: true,
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
  const signingSecret = generateSigningSecret();

  const endpoint = await prisma.developerWebhookEndpoint.create({
    data: {
      companyId,
      name: input.name,
      url: input.url,
      signingSecretEncrypted: encryptText(signingSecret),
      secretPrefix: signingSecret.slice(0, 10),
      secretLast4: signingSecret.slice(-4),
      status: "ACTIVE",
    },
    select: {
      id: true,
      companyId: true,
      name: true,
      url: true,
      secretPrefix: true,
      secretLast4: true,
      status: true,
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
      secretPrefix: true,
      secretLast4: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getActiveDeveloperWebhookEndpoints(companyId: string) {
  return prisma.developerWebhookEndpoint.findMany({
    where: {
      companyId,
      status: "ACTIVE",
    },
  });
}

type EnqueueDeveloperWebhookInput = {
  companyId: string;
  eventType: string;
  payload: Record<string, unknown>;
};

export async function enqueueDeveloperWebhookDeliveries(
  input: EnqueueDeveloperWebhookInput,
) {
  if (!(await hasCompanyFeature(input.companyId, "DEVELOPER_WEBHOOKS"))) {
    return [];
  }

  const endpoints = await getActiveDeveloperWebhookEndpoints(input.companyId);

  if (endpoints.length === 0) {
    return [];
  }

  const deliveries = [];

  for (const endpoint of endpoints) {
    const delivery = await prisma.developerWebhookDelivery.create({
      data: {
        companyId: input.companyId,
        endpointId: endpoint.id,
        eventType: input.eventType,
        payload: input.payload as Prisma.InputJsonValue,
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

  return enqueueDeveloperWebhookDeliveries({
    companyId,
    eventType: "message.status_updated",
    payload: {
      id: `evt_${message.id}_${message.status}_${Date.now()}`,
      type: "message.status_updated",
      createdAt: new Date().toISOString(),
      data: {
        messageId: message.id,
        status: message.status,
        direction: message.direction,
        toPhoneNumber: message.toPhoneNumber,
        metaMessageId: message.metaMessageId,
        template: message.template
          ? {
              id: message.template.id,
              name: message.template.name,
              language: message.template.language,
            }
          : null,
        contact: {
          id: message.contact.id,
          name: message.contact.name,
          countryCode: message.contact.countryCode,
          phoneNumber: message.contact.phoneNumber,
        },
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
      },
    },
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

  const delivery = await prisma.developerWebhookDelivery.create({
    data: {
      companyId,
      endpointId: endpoint.id,
      eventType: "webhook.test",
      status: "PENDING",
      payload: {
        id: `evt_test_${Date.now()}`,
        type: "webhook.test",
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

  return enqueueDeveloperWebhookDeliveries({
    companyId,
    eventType: "message.received",
    payload: {
      id: `evt_${message.id}_received_${Date.now()}`,
      type: "message.received",
      createdAt: new Date().toISOString(),
      data: {
        messageId: message.id,
        status: message.status,
        direction: message.direction,
        fromPhoneNumber: message.toPhoneNumber,
        body: message.body,
        metaMessageId: message.metaMessageId,
        contact: {
          id: message.contact.id,
          name: message.contact.name,
          countryCode: message.contact.countryCode,
          phoneNumber: message.contact.phoneNumber,
        },
        createdAt: message.createdAt.toISOString(),
        updatedAt: message.updatedAt.toISOString(),
      },
    },
  });
}
