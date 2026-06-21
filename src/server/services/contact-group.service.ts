import { prisma } from "@/lib/prisma";
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
) {
  const normalizedContacts = input.contacts.map((contact) => ({
    countryCode: normalizeDigits(contact.countryCode),
    phoneNumber: normalizeDigits(contact.phoneNumber),
    name: contact.name?.trim() || null,
    source: contact.source?.trim() || "GROUP_IMPORT",
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
        data: uniqueContacts.map((contact) => ({ companyId, ...contact })),
        skipDuplicates: true,
      });

      const contacts = await tx.contact.findMany({
        where: {
          companyId,
          phoneNumber: { in: uniqueContacts.map((item) => item.phoneNumber) },
        },
        select: { id: true },
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
      };
    },
    { timeout: 30_000 },
  );

  return {
    requestedCount: input.contacts.length,
    uniqueCount: uniqueContacts.length,
    ...result,
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
