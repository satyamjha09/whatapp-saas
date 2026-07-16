import type { Prisma } from "@/generated/prisma/client";
import type { DeveloperWebhookEvent } from "@/server/config/developer-webhook-events";
import { publishDeveloperWebhookEvent } from "@/server/services/developer-webhook-outbox.service";

export async function publishPartnerWebhookEvent({
  eventType,
  idempotencyKey,
  partnerCompanyId,
  payload,
}: {
  partnerCompanyId: string;
  eventType: Extract<DeveloperWebhookEvent, `partner.${string}`>;
  payload: Prisma.InputJsonValue;
  idempotencyKey?: string;
}) {
  return publishDeveloperWebhookEvent({
    companyId: partnerCompanyId,
    eventType,
    payload,
    idempotencyKey,
  });
}
