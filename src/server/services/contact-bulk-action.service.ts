import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";
import {
  addContactsToList,
  removeContactsFromList,
  ContactListError,
} from "@/server/services/contact-list.service";
import type { BulkContactActionInput } from "@/server/validators/contact-list.validator";

export class ContactBulkActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactBulkActionError";
  }
}

async function verifyCompanyContactIds(companyId: string, contactIds: string[]) {
  const uniqueIds = Array.from(new Set(contactIds));

  const contacts = await prisma.contact.findMany({
    where: { companyId, id: { in: uniqueIds } },
    select: { id: true },
  });

  if (contacts.length !== uniqueIds.length) {
    throw new ContactBulkActionError(
      "Some contacts were not found in this workspace.",
    );
  }

  return contacts.map((contact) => contact.id);
}

export async function runBulkContactAction({
  companyId,
  actorUserId,
  input,
}: {
  companyId: string;
  actorUserId?: string | null;
  input: BulkContactActionInput;
}) {
  if (input.action === "ADD_TO_LIST") {
    try {
      const result = await addContactsToList({
        companyId,
        actorUserId,
        listId: input.listId as string,
        contactIds: input.contactIds,
      });

      return { action: input.action, affected: result.addedCount };
    } catch (error) {
      if (error instanceof ContactListError) {
        throw new ContactBulkActionError(error.message);
      }
      throw error;
    }
  }

  if (input.action === "REMOVE_FROM_LIST") {
    try {
      const result = await removeContactsFromList({
        companyId,
        actorUserId,
        listId: input.listId as string,
        contactIds: input.contactIds,
      });

      return { action: input.action, affected: result.removedCount };
    } catch (error) {
      if (error instanceof ContactListError) {
        throw new ContactBulkActionError(error.message);
      }
      throw error;
    }
  }

  const verifiedIds = await verifyCompanyContactIds(companyId, input.contactIds);
  const tagName = (input.tagName as string).trim();

  if (input.action === "ADD_TAG") {
    const tag = await prisma.inboxTag.upsert({
      where: { companyId_name: { companyId, name: tagName } },
      update: {},
      create: { companyId, name: tagName },
    });

    const created = await prisma.contactInboxTag.createMany({
      data: verifiedIds.map((contactId) => ({
        companyId,
        contactId,
        tagId: tag.id,
      })),
      skipDuplicates: true,
    });

    await createAuditLog({
      companyId,
      actorUserId,
      action: "contacts.bulk_tag_added",
      entityType: "InboxTag",
      entityId: tag.id,
      metadata: { tagName, affected: created.count },
    }).catch(() => undefined);

    return { action: input.action, affected: created.count };
  }

  // REMOVE_TAG
  const tag = await prisma.inboxTag.findFirst({
    where: { companyId, name: { equals: tagName, mode: "insensitive" } },
    select: { id: true, name: true },
  });

  if (!tag) {
    throw new ContactBulkActionError("Tag not found.");
  }

  const removed = await prisma.contactInboxTag.deleteMany({
    where: {
      companyId,
      tagId: tag.id,
      contactId: { in: verifiedIds },
    },
  });

  await createAuditLog({
    companyId,
    actorUserId,
    action: "contacts.bulk_tag_removed",
    entityType: "InboxTag",
    entityId: tag.id,
    metadata: { tagName: tag.name, affected: removed.count },
  }).catch(() => undefined);

  return { action: input.action, affected: removed.count };
}
