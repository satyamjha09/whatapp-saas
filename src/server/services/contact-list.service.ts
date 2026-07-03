import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";

/**
 * Contact "lists" are backed by the existing ContactGroup / ContactGroupMember
 * models (static membership). This service adds the list-management surface
 * used by the Import & Broadcast Suite on top of contact-group.service.ts.
 */

export class ContactListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactListError";
  }
}

// TODO: Replace with plan-based entitlements once list limits are added to
// the plan gating system.
function maxListsPerCompany() {
  const value = Number(process.env.CONTACT_LISTS_MAX_PER_COMPANY ?? 100);
  return Number.isFinite(value) && value > 0 ? value : 100;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function listContactLists({
  companyId,
  search,
}: {
  companyId: string;
  search?: string;
}) {
  const lists = await prisma.contactGroup.findMany({
    where: {
      companyId,
      ...(search
        ? { name: { contains: search.trim(), mode: "insensitive" } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { members: true } } },
    take: 200,
  });

  return lists.map((list) => ({
    id: list.id,
    name: list.name,
    description: list.description,
    color: list.color,
    contactsCount: list._count.members,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  }));
}

export async function createContactList({
  companyId,
  actorUserId,
  name,
  description,
}: {
  companyId: string;
  actorUserId?: string | null;
  name: string;
  description?: string | null;
}) {
  const total = await prisma.contactGroup.count({ where: { companyId } });

  if (total >= maxListsPerCompany()) {
    throw new ContactListError(
      `Company cannot have more than ${maxListsPerCompany()} contact lists.`,
    );
  }

  let list;

  try {
    list = await prisma.contactGroup.create({
      data: {
        companyId,
        name: name.trim(),
        description: description?.trim() || null,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ContactListError("A contact list with this name already exists.");
    }
    throw error;
  }

  await createAuditLog({
    companyId,
    actorUserId,
    action: "contact_list.created",
    entityType: "ContactGroup",
    entityId: list.id,
    metadata: { name: list.name },
  }).catch(() => undefined);

  return list;
}

export async function getContactList({
  companyId,
  listId,
}: {
  companyId: string;
  listId: string;
}) {
  const list = await prisma.contactGroup.findFirst({
    where: { id: listId, companyId },
    include: { _count: { select: { members: true } } },
  });

  if (!list) {
    throw new ContactListError("Contact list not found.");
  }

  return {
    id: list.id,
    name: list.name,
    description: list.description,
    color: list.color,
    contactsCount: list._count.members,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  };
}

export async function updateContactList({
  companyId,
  actorUserId,
  listId,
  name,
  description,
}: {
  companyId: string;
  actorUserId?: string | null;
  listId: string;
  name?: string;
  description?: string | null;
}) {
  const existing = await prisma.contactGroup.findFirst({
    where: { id: listId, companyId },
    select: { id: true, name: true },
  });

  if (!existing) {
    throw new ContactListError("Contact list not found.");
  }

  let updated;

  try {
    updated = await prisma.contactGroup.update({
      where: { id: existing.id },
      data: {
        name: name?.trim() || undefined,
        description:
          description === undefined ? undefined : description?.trim() || null,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new ContactListError("A contact list with this name already exists.");
    }
    throw error;
  }

  await createAuditLog({
    companyId,
    actorUserId,
    action: "contact_list.updated",
    entityType: "ContactGroup",
    entityId: existing.id,
    metadata: { previousName: existing.name, name: updated.name },
  }).catch(() => undefined);

  return updated;
}

export async function deleteContactList({
  companyId,
  actorUserId,
  listId,
}: {
  companyId: string;
  actorUserId?: string | null;
  listId: string;
}) {
  const existing = await prisma.contactGroup.findFirst({
    where: { id: listId, companyId },
    select: { id: true, name: true },
  });

  if (!existing) {
    throw new ContactListError("Contact list not found.");
  }

  // Members cascade; contacts themselves are never deleted.
  await prisma.contactGroup.delete({ where: { id: existing.id } });

  await createAuditLog({
    companyId,
    actorUserId,
    action: "contact_list.deleted",
    entityType: "ContactGroup",
    entityId: existing.id,
    metadata: { name: existing.name },
  }).catch(() => undefined);

  return { deleted: true };
}

async function requireCompanyContacts({
  companyId,
  contactIds,
}: {
  companyId: string;
  contactIds: string[];
}) {
  const uniqueIds = Array.from(new Set(contactIds));

  const contacts = await prisma.contact.findMany({
    where: {
      companyId,
      id: { in: uniqueIds },
    },
    select: { id: true },
  });

  if (contacts.length !== uniqueIds.length) {
    throw new ContactListError(
      "Some contacts were not found in this workspace.",
    );
  }

  return contacts.map((contact) => contact.id);
}

export async function addContactsToList({
  companyId,
  actorUserId,
  listId,
  contactIds,
}: {
  companyId: string;
  actorUserId?: string | null;
  listId: string;
  contactIds: string[];
}) {
  const list = await prisma.contactGroup.findFirst({
    where: { id: listId, companyId },
    select: { id: true, name: true },
  });

  if (!list) {
    throw new ContactListError("Contact list not found.");
  }

  const verifiedIds = await requireCompanyContacts({ companyId, contactIds });

  const added = await prisma.contactGroupMember.createMany({
    data: verifiedIds.map((contactId) => ({
      groupId: list.id,
      contactId,
    })),
    skipDuplicates: true,
  });

  await createAuditLog({
    companyId,
    actorUserId,
    action: "contact_list.members_added",
    entityType: "ContactGroup",
    entityId: list.id,
    metadata: {
      requested: contactIds.length,
      added: added.count,
    },
  }).catch(() => undefined);

  return {
    addedCount: added.count,
    alreadyInListCount: verifiedIds.length - added.count,
  };
}

export async function removeContactsFromList({
  companyId,
  actorUserId,
  listId,
  contactIds,
}: {
  companyId: string;
  actorUserId?: string | null;
  listId: string;
  contactIds: string[];
}) {
  const list = await prisma.contactGroup.findFirst({
    where: { id: listId, companyId },
    select: { id: true, name: true },
  });

  if (!list) {
    throw new ContactListError("Contact list not found.");
  }

  // Removes membership only; the contacts themselves are untouched.
  const removed = await prisma.contactGroupMember.deleteMany({
    where: {
      groupId: list.id,
      contactId: { in: Array.from(new Set(contactIds)) },
      contact: { companyId },
    },
  });

  await createAuditLog({
    companyId,
    actorUserId,
    action: "contact_list.members_removed",
    entityType: "ContactGroup",
    entityId: list.id,
    metadata: { removed: removed.count },
  }).catch(() => undefined);

  return { removedCount: removed.count };
}

export async function getListContactsPage({
  companyId,
  listId,
  search,
  page = 1,
  pageSize = 25,
}: {
  companyId: string;
  listId: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const list = await prisma.contactGroup.findFirst({
    where: { id: listId, companyId },
    select: { id: true },
  });

  if (!list) {
    throw new ContactListError("Contact list not found.");
  }

  const take = Math.min(Math.max(pageSize, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const cleanedSearch = search?.trim();

  const where = {
    groupId: list.id,
    contact: {
      companyId,
      ...(cleanedSearch
        ? {
            OR: [
              { name: { contains: cleanedSearch, mode: "insensitive" as const } },
              { phoneNumber: { contains: cleanedSearch } },
              { email: { contains: cleanedSearch, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
  };

  const [members, total] = await Promise.all([
    prisma.contactGroupMember.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            countryCode: true,
            phoneNumber: true,
            email: true,
            city: true,
            optedOutAt: true,
            lastRepliedAt: true,
            inboxTags: {
              select: { tag: { select: { name: true } } },
              take: 5,
            },
          },
        },
      },
    }),
    prisma.contactGroupMember.count({ where }),
  ]);

  return {
    contacts: members.map((member) => ({
      memberId: member.id,
      id: member.contact.id,
      name: member.contact.name,
      countryCode: member.contact.countryCode,
      phoneNumber: member.contact.phoneNumber,
      email: member.contact.email,
      city: member.contact.city,
      optedOut: Boolean(member.contact.optedOutAt),
      lastMessageAt: member.contact.lastRepliedAt,
      tags: member.contact.inboxTags.map((entry) => entry.tag.name),
      addedAt: member.createdAt,
    })),
    pagination: {
      page: Math.max(page, 1),
      pageSize: take,
      total,
      totalPages: Math.max(Math.ceil(total / take), 1),
    },
  };
}
