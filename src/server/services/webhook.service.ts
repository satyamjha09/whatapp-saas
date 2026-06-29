import { getWebhookQueue } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type CreateWebhookEventInput = {
  payload: unknown;
  eventType?: string | null;
  companyId?: string | null;
  dedupeKey?: string | null;
};

type CreateUnmappedWebhookEventInput = {
  payload: unknown;
  eventType?: string | null;
  phoneNumberId?: string | null;
  dedupeKey?: string | null;
  reason: string;
};

export async function createWebhookEvent(input: CreateWebhookEventInput) {
  if (input.dedupeKey) {
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: {
        dedupeKey: input.dedupeKey,
      },
    });

    if (existingEvent) {
      return {
        webhookEvent: existingEvent,
        isDuplicate: true,
      };
    }
  }

  const webhookEvent = await prisma.webhookEvent.create({
    data: {
      payload: input.payload as Prisma.InputJsonValue,
      eventType: input.eventType,
      companyId: input.companyId,
      dedupeKey: input.dedupeKey,
      status: "RECEIVED",
    },
  });

  await getWebhookQueue().add("process-whatsapp-webhook", {
    webhookEventId: webhookEvent.id,
  });

  return {
    webhookEvent,
    isDuplicate: false,
  };
}

export async function createUnmappedWebhookEvent(
  input: CreateUnmappedWebhookEventInput,
) {
  if (input.dedupeKey) {
    const existingEvent = await prisma.unmappedWebhookEvent.findUnique({
      where: {
        dedupeKey: input.dedupeKey,
      },
    });

    if (existingEvent) {
      return {
        unmappedWebhookEvent: existingEvent,
        isDuplicate: true,
      };
    }
  }

  const unmappedWebhookEvent = await prisma.unmappedWebhookEvent.create({
    data: {
      provider: "META",
      phoneNumberId: input.phoneNumberId,
      eventType: input.eventType,
      payload: input.payload as Prisma.InputJsonValue,
      reason: input.reason,
      dedupeKey: input.dedupeKey,
      status: "UNRESOLVED",
    },
  });

  return {
    unmappedWebhookEvent,
    isDuplicate: false,
  };
}

export async function reprocessUnmappedWebhookEvent({
  unmappedWebhookEventId,
  companyId,
}: {
  unmappedWebhookEventId: string;
  companyId: string;
}) {
  const unmappedWebhookEvent = await prisma.unmappedWebhookEvent.findUnique({
    where: {
      id: unmappedWebhookEventId,
    },
  });

  if (!unmappedWebhookEvent) {
    throw new Error("Unmapped webhook event not found");
  }

  if (unmappedWebhookEvent.status === "RESOLVED") {
    throw new Error("Unmapped webhook event is already resolved");
  }

  const company = await prisma.company.findUnique({
    where: {
      id: companyId,
    },
    select: {
      id: true,
    },
  });

  if (!company) {
    throw new Error("Company not found");
  }

  const webhookEvent = await prisma.webhookEvent.create({
    data: {
      payload: unmappedWebhookEvent.payload as Prisma.InputJsonValue,
      eventType: unmappedWebhookEvent.eventType,
      companyId,
      dedupeKey: `reprocess:${unmappedWebhookEvent.id}`,
      status: "RECEIVED",
    },
  });

  await getWebhookQueue().add("process-whatsapp-webhook", {
    webhookEventId: webhookEvent.id,
  });

  return prisma.unmappedWebhookEvent.update({
    where: {
      id: unmappedWebhookEvent.id,
    },
    data: {
      status: "RESOLVED",
      resolvedCompanyId: companyId,
      resolvedWebhookEventId: webhookEvent.id,
      resolvedAt: new Date(),
    },
  });
}

export async function findCompanyByPhoneNumberId(phoneNumberId: string) {
  const phoneNumber = await prisma.whatsAppPhoneNumber.findFirst({
    where: {
      phoneNumberId,
    },
  });

  return phoneNumber?.companyId ?? null;
}
