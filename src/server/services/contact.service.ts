import { prisma } from "@/lib/prisma";
import { publishContactDeveloperWebhookEvent } from "@/server/services/developer-webhook-event-publisher.service";
import {
  assertUsageQuotaAvailable,
  incrementUsageQuota,
} from "@/server/services/usage-quota.service";
import { CreateContactInput } from "@/server/validators/contact.validator";

export async function getContactsByCompany(companyId: string) {
  return prisma.contact.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createContactForCompany(
  companyId: string,
  input: CreateContactInput,
) {
  await assertUsageQuotaAvailable({
    companyId,
    featureKey: "CONTACTS",
    amount: 1,
  });

  const contact = await prisma.contact.create({
    data: {
      companyId,
      name: input.name || null,
      countryCode: input.countryCode,
      phoneNumber: input.phoneNumber,
    },
  });

  await publishContactDeveloperWebhookEvent({
    companyId,
    contact,
    operation: "created",
  });

  await incrementUsageQuota({
    companyId,
    featureKey: "CONTACTS",
    amount: 1,
    idempotencyKey: `contact-created:${contact.id}`,
    reason: "contact-created",
    metadata: {
      contactId: contact.id,
    },
  });

  return contact;
}

export async function upsertContactForCompany(
  companyId: string,
  input: CreateContactInput,
) {
  const existingContact = await prisma.contact.findUnique({
    where: {
      companyId_phoneNumber: {
        companyId,
        phoneNumber: input.phoneNumber,
      },
    },
    select: { id: true },
  });

  const contact = await prisma.contact.upsert({
    where: {
      companyId_phoneNumber: {
        companyId,
        phoneNumber: input.phoneNumber,
      },
    },
    update: {
      name: input.name || null,
      countryCode: input.countryCode,
    },
    create: {
      companyId,
      name: input.name || null,
      countryCode: input.countryCode,
      phoneNumber: input.phoneNumber,
    },
  });

  await publishContactDeveloperWebhookEvent({
    companyId,
    contact,
    operation: existingContact ? "updated" : "created",
  });

  return contact;
}
