import { getWebhookQueue } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type CreateWebhookEventInput = {
  payload: unknown;
  eventType?: string | null;
  companyId?: string | null;
  dedupeKey?: string | null;
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

export async function findCompanyByPhoneNumberId(phoneNumberId: string) {
  const phoneNumber = await prisma.whatsAppPhoneNumber.findFirst({
    where: {
      phoneNumberId,
    },
  });

  return phoneNumber?.companyId ?? null;
}
