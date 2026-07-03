import { Prisma } from "@/generated/prisma/client";
import { buildWhereForSavedSegment } from "@/server/services/contact-segment-builder.service";
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

export type ContactListFilters = {
  search?: string;
  listId?: string;
  segmentId?: string;
  tag?: string;
  optedOut?: "true" | "false";
  page?: number;
  pageSize?: number;
};

/**
 * Filtered, paginated contact listing for the contacts page
 * (Import & Broadcast Suite - Phase 16B).
 */
export async function listContactsFiltered(
  companyId: string,
  filters: ContactListFilters,
) {
  const take = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);
  const page = Math.max(filters.page ?? 1, 1);
  const search = filters.search?.trim();

  const conditions: Prisma.ContactWhereInput[] = [{ companyId }];

  if (search) {
    conditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
        { companyName: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (filters.listId) {
    conditions.push({
      contactGroupMembers: {
        some: { group: { id: filters.listId, companyId } },
      },
    });
  }

  if (filters.tag) {
    conditions.push({
      inboxTags: {
        some: {
          tag: { name: { equals: filters.tag.trim(), mode: "insensitive" } },
        },
      },
    });
  }

  if (filters.optedOut === "true") {
    conditions.push({ optedOutAt: { not: null } });
  } else if (filters.optedOut === "false") {
    conditions.push({ optedOutAt: null });
  }

  if (filters.segmentId) {
    // Segment rules are evaluated dynamically and tenant-scoped internally.
    conditions.push(
      await buildWhereForSavedSegment({
        companyId,
        segmentId: filters.segmentId,
      }),
    );
  }

  const where: Prisma.ContactWhereInput = { AND: conditions };

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
      select: {
        id: true,
        name: true,
        countryCode: true,
        phoneNumber: true,
        email: true,
        companyName: true,
        city: true,
        source: true,
        optedOutAt: true,
        lastRepliedAt: true,
        createdAt: true,
        inboxTags: {
          select: { tag: { select: { name: true } } },
          take: 5,
        },
      },
    }),
    prisma.contact.count({ where }),
  ]);

  return {
    contacts: contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      countryCode: contact.countryCode,
      phoneNumber: contact.phoneNumber,
      email: contact.email,
      companyName: contact.companyName,
      city: contact.city,
      source: contact.source,
      optedOut: Boolean(contact.optedOutAt),
      lastMessageAt: contact.lastRepliedAt,
      createdAt: contact.createdAt,
      tags: contact.inboxTags.map((entry) => entry.tag.name),
    })),
    pagination: {
      page,
      pageSize: take,
      total,
      totalPages: Math.max(Math.ceil(total / take), 1),
    },
  };
}
