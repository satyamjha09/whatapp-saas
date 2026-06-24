import { prisma } from "@/lib/prisma";
import { recordContactConsent } from "@/server/services/contact-consent.service";
import type {
  CreateContactGroupInput,
  ImportContactsToGroupInput,
} from "@/server/validators/contact-group.validator";

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function normalizeConsentValue(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();

  if (["yes", "true", "granted", "opt-in", "opted in"].includes(normalized ?? "")) {
    return "GRANTED" as const;
  }

  if (["no", "false", "revoked", "opt-out", "opted out"].includes(normalized ?? "")) {
    return "REVOKED" as const;
  }

  return null;
}

export function getContactGroupsByCompany(companyId: string) {
  return prisma.contactGroup.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { members: true } } },
  });
}

export async function createContactGroup(
  companyId: string,
  input: CreateContactGroupInput,
) {
  try {
    return await prisma.contactGroup.create({
      data: {
        companyId,
        name: input.name,
        description: input.description || null,
        color: input.color || null,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new Error("A contact group with this name already exists");
    }
    throw error;
  }
}

export function getContactGroupDetail(companyId: string, groupId: string) {
  return prisma.contactGroup.findFirst({
    where: { id: groupId, companyId },
    include: {
      members: {
        orderBy: { createdAt: "desc" },
        take: 2000,
        include: { contact: true },
      },
      _count: { select: { members: true } },
    },
  });
}

export async function importContactsToGroup(
  companyId: string,
  groupId: string,
  input: ImportContactsToGroupInput,
  actorUserId?: string | null,
) {
  const normalizedContacts = input.contacts.map((contact) => ({
    countryCode: normalizeDigits(contact.countryCode),
    phoneNumber: normalizeDigits(contact.phoneNumber),
    name: contact.name?.trim() || null,
    source: contact.source?.trim() || "GROUP_IMPORT",
    marketingConsent: contact.marketingConsent?.trim() || null,
    marketingConsentEvidence: contact.marketingConsentEvidence?.trim() || null,
    utilityConsent: contact.utilityConsent?.trim() || null,
    utilityConsentEvidence: contact.utilityConsentEvidence?.trim() || null,
  }));
  // Contact identity in the existing schema is company + local phone number.
  const uniqueContacts = Array.from(
    new Map(
      normalizedContacts.map((contact) => [contact.phoneNumber, contact]),
    ).values(),
  );

  const result = await prisma.$transaction(
    async (tx) => {
      const group = await tx.contactGroup.findFirst({
        where: { id: groupId, companyId },
        select: { id: true },
      });
      if (!group) throw new Error("Contact group not found");

      await tx.contact.createMany({
        data: uniqueContacts.map((contact) => ({
          companyId,
          countryCode: contact.countryCode,
          phoneNumber: contact.phoneNumber,
          name: contact.name,
          source: contact.source,
        })),
        skipDuplicates: true,
      });

      const contacts = await tx.contact.findMany({
        where: {
          companyId,
          phoneNumber: { in: uniqueContacts.map((item) => item.phoneNumber) },
        },
        select: { id: true, phoneNumber: true },
      });
      const added = await tx.contactGroupMember.createMany({
        data: contacts.map((contact) => ({
          groupId: group.id,
          contactId: contact.id,
        })),
        skipDuplicates: true,
      });

      return {
        addedCount: added.count,
        alreadyInGroupCount: contacts.length - added.count,
        contacts,
      };
    },
    { timeout: 30_000 },
  );

  const contactIdByPhone = new Map(
    result.contacts.map((contact) => [contact.phoneNumber, contact.id]),
  );

  for (const contact of uniqueContacts) {
    const contactId = contactIdByPhone.get(contact.phoneNumber);
    const marketingStatus = normalizeConsentValue(contact.marketingConsent);
    const utilityStatus = normalizeConsentValue(contact.utilityConsent);

    if (!contactId) continue;

    if (marketingStatus) {
      await recordContactConsent({
        companyId,
        contactId,
        type: "WHATSAPP_MARKETING",
        status: marketingStatus,
        source: "IMPORT",
        actorUserId,
        evidenceText:
          contact.marketingConsentEvidence ??
          `Imported with marketing consent = ${contact.marketingConsent}`,
        metadata: {
          groupId,
          importSource: contact.source,
        },
      });
    }

    if (utilityStatus) {
      await recordContactConsent({
        companyId,
        contactId,
        type: "WHATSAPP_UTILITY",
        status: utilityStatus,
        source: "IMPORT",
        actorUserId,
        evidenceText:
          contact.utilityConsentEvidence ??
          `Imported with utility consent = ${contact.utilityConsent}`,
        metadata: {
          groupId,
          importSource: contact.source,
        },
      });
    }
  }

  return {
    requestedCount: input.contacts.length,
    uniqueCount: uniqueContacts.length,
    addedCount: result.addedCount,
    alreadyInGroupCount: result.alreadyInGroupCount,
    skippedDuplicateCount: input.contacts.length - uniqueContacts.length,
  };
}

export async function removeContactFromGroup(
  companyId: string,
  groupId: string,
  memberId: string,
) {
  const deleted = await prisma.contactGroupMember.deleteMany({
    where: {
      id: memberId,
      groupId,
      group: { companyId },
    },
  });

  if (deleted.count !== 1) throw new Error("Group member not found");
  return { removed: true, memberId };
}
