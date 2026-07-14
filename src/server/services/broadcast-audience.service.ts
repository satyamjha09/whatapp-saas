import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSegmentContactsForCampaign } from "@/server/services/contact-segment-builder.service";

export type BroadcastAudienceFilters = {
  city?: string | null;
  source?: string | null;
  tag?: string | null;
};

export type BroadcastAudiencePreviewInput = {
  companyId: string;
  filters?: BroadcastAudienceFilters;
  groupIds?: string[];
  requireMarketingConsent?: boolean;
  segmentIds?: string[];
};

type AudienceContact = {
  city: string | null;
  countryCode: string;
  id: string;
  isBlocked: boolean;
  marketingConsentStatus: string;
  name: string | null;
  optedOutAt: Date | null;
  phoneNumber: string;
  source: string;
  tags: string[];
};

export type BroadcastAudienceContact = AudienceContact & {
  normalizedPhone: string;
};

export type BroadcastAudienceResolution = {
  blocked: number;
  duplicatePhones: number;
  duplicateSelections: number;
  eligibleContacts: BroadcastAudienceContact[];
  invalidPhone: number;
  missingConsent: number;
  optedOut: number;
  totalMatched: number;
};

export function normalizeBroadcastPhone(countryCode: string, phoneNumber: string) {
  return `${countryCode}${phoneNumber}`.replace(/\D/g, "");
}

function isValidWhatsAppPhone(countryCode: string, phoneNumber: string) {
  const normalized = normalizeBroadcastPhone(countryCode, phoneNumber);
  return normalized.length >= 8 && normalized.length <= 15;
}

function buildFilterWhere(
  companyId: string,
  filters: BroadcastAudienceFilters,
): Prisma.ContactWhereInput | null {
  const clauses: Prisma.ContactWhereInput[] = [];

  if (filters.city?.trim()) {
    clauses.push({
      city: {
        contains: filters.city.trim(),
        mode: "insensitive",
      },
    });
  }

  if (filters.source?.trim()) {
    clauses.push({
      source: {
        equals: filters.source.trim(),
        mode: "insensitive",
      },
    });
  }

  if (filters.tag?.trim()) {
    clauses.push({
      inboxTags: {
        some: {
          tag: {
            name: {
              contains: filters.tag.trim(),
              mode: "insensitive",
            },
          },
        },
      },
    });
  }

  if (clauses.length === 0) return null;

  return {
    AND: clauses,
    companyId,
  };
}

function toAudienceContact(contact: {
  city: string | null;
  countryCode: string;
  id: string;
  inboxTags?: Array<{ tag: { name: string } }>;
  isBlocked: boolean;
  marketingConsentStatus: string;
  name: string | null;
  optedOutAt: Date | null;
  phoneNumber: string;
  source: string;
}): AudienceContact {
  return {
    city: contact.city,
    countryCode: contact.countryCode,
    id: contact.id,
    isBlocked: contact.isBlocked,
    marketingConsentStatus: contact.marketingConsentStatus,
    name: contact.name,
    optedOutAt: contact.optedOutAt,
    phoneNumber: contact.phoneNumber,
    source: contact.source,
    tags: contact.inboxTags?.map((entry) => entry.tag.name) ?? [],
  };
}

export async function getBroadcastAudienceOptions(companyId: string) {
  const [groups, segments, tags, cities, sources] = await Promise.all([
    prisma.contactGroup.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            members: true,
          },
        },
      },
      take: 100,
    }),
    prisma.contactSegment.findMany({
      where: {
        companyId,
        status: "ACTIVE",
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        lastPreviewCount: true,
        name: true,
      },
      take: 100,
    }),
    prisma.inboxTag.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
      take: 100,
    }),
    prisma.contact.findMany({
      distinct: ["city"],
      orderBy: { city: "asc" },
      select: { city: true },
      where: {
        city: {
          not: null,
        },
        companyId,
      },
      take: 100,
    }),
    prisma.contact.findMany({
      distinct: ["source"],
      orderBy: { source: "asc" },
      select: { source: true },
      where: { companyId },
      take: 100,
    }),
  ]);

  return {
    cities: cities.map((entry) => entry.city).filter(Boolean),
    groups,
    segments,
    sources: sources.map((entry) => entry.source).filter(Boolean),
    tags,
  };
}

export async function previewBroadcastAudience(
  input: BroadcastAudiencePreviewInput,
) {
  const resolution = await resolveBroadcastAudience(input);

  return {
    counts: {
      blocked: resolution.blocked,
      duplicatePhones: resolution.duplicatePhones,
      duplicateSelections: resolution.duplicateSelections,
      eligible: resolution.eligibleContacts.length,
      invalidPhone: resolution.invalidPhone,
      missingConsent: resolution.missingConsent,
      optedOut: resolution.optedOut,
      totalMatched: resolution.totalMatched,
    },
    sampleContacts: resolution.eligibleContacts.slice(0, 10).map((contact) => ({
      city: contact.city,
      id: contact.id,
      name: contact.name,
      phone: `+${contact.normalizedPhone}`,
      source: contact.source,
      tags: contact.tags,
    })),
  };
}

export async function resolveBroadcastAudience(
  input: BroadcastAudiencePreviewInput,
): Promise<BroadcastAudienceResolution> {
  const groupIds = Array.from(new Set(input.groupIds ?? []));
  const segmentIds = Array.from(new Set(input.segmentIds ?? []));
  const filters = input.filters ?? {};
  const filterWhere = buildFilterWhere(input.companyId, filters);
  const contactsById = new Map<string, AudienceContact>();
  const sourcesByContactId = new Map<string, Set<string>>();

  function addContacts(contacts: AudienceContact[], source: string) {
    contacts.forEach((contact) => {
      contactsById.set(contact.id, contact);

      const sources = sourcesByContactId.get(contact.id) ?? new Set<string>();
      sources.add(source);
      sourcesByContactId.set(contact.id, sources);
    });
  }

  if (groupIds.length > 0) {
    const groupContacts = await prisma.contactGroupMember.findMany({
      where: {
        groupId: {
          in: groupIds,
        },
        group: {
          companyId: input.companyId,
        },
      },
      select: {
        contact: {
          select: {
            city: true,
            countryCode: true,
            id: true,
            inboxTags: {
              select: { tag: { select: { name: true } } },
              take: 5,
            },
            isBlocked: true,
            marketingConsentStatus: true,
            name: true,
            optedOutAt: true,
            phoneNumber: true,
            source: true,
          },
        },
      },
      take: 5000,
    });

    addContacts(
      groupContacts.map((entry) => toAudienceContact(entry.contact)),
      "group",
    );
  }

  for (const segmentId of segmentIds) {
    const segmentContacts = await getSegmentContactsForCampaign({
      companyId: input.companyId,
      limit: 5000,
      segmentId,
    });

    addContacts(
      segmentContacts.map(toAudienceContact),
      "segment",
    );
  }

  if (filterWhere) {
    const filteredContacts = await prisma.contact.findMany({
      where: filterWhere,
      select: {
        city: true,
        countryCode: true,
        id: true,
        inboxTags: {
          select: { tag: { select: { name: true } } },
          take: 5,
        },
        isBlocked: true,
        marketingConsentStatus: true,
        name: true,
        optedOutAt: true,
        phoneNumber: true,
        source: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    addContacts(filteredContacts.map(toAudienceContact), "filter");
  }

  if (groupIds.length === 0 && segmentIds.length === 0 && !filterWhere) {
    const allContacts = await prisma.contact.findMany({
      where: { companyId: input.companyId },
      select: {
        city: true,
        countryCode: true,
        id: true,
        inboxTags: {
          select: { tag: { select: { name: true } } },
          take: 5,
        },
        isBlocked: true,
        marketingConsentStatus: true,
        name: true,
        optedOutAt: true,
        phoneNumber: true,
        source: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5000,
    });

    addContacts(allContacts.map(toAudienceContact), "all");
  }

  const contacts = [...contactsById.values()];
  const duplicateSelections = [...sourcesByContactId.values()].filter(
    (sources) => sources.size > 1,
  ).length;
  let blocked = 0;
  let invalidPhone = 0;
  let optedOut = 0;
  let missingConsent = 0;
  const duplicatePhones = new Set<string>();
  const seenPhones = new Set<string>();

  const eligibleContacts = contacts.filter((contact) => {
    const normalizedPhone = normalizeBroadcastPhone(
      contact.countryCode,
      contact.phoneNumber,
    );

    if (seenPhones.has(normalizedPhone)) {
      duplicatePhones.add(normalizedPhone);
      return false;
    }
    seenPhones.add(normalizedPhone);

    if (contact.isBlocked) {
      blocked += 1;
      return false;
    }

    if (contact.optedOutAt) {
      optedOut += 1;
      return false;
    }

    if (!isValidWhatsAppPhone(contact.countryCode, contact.phoneNumber)) {
      invalidPhone += 1;
      return false;
    }

    if (
      input.requireMarketingConsent !== false &&
      contact.marketingConsentStatus !== "GRANTED"
    ) {
      missingConsent += 1;
      return false;
    }

    return true;
  }).map((contact) => ({
    ...contact,
    normalizedPhone: normalizeBroadcastPhone(
      contact.countryCode,
      contact.phoneNumber,
    ),
  }));

  return {
    blocked,
    duplicatePhones: duplicatePhones.size,
    duplicateSelections,
    eligibleContacts,
    invalidPhone,
    missingConsent,
    optedOut,
    totalMatched: contacts.length,
  };
}
