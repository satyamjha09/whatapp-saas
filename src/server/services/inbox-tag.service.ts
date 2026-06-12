import { prisma } from "@/lib/prisma";
import {
  AddConversationTagInput,
  CreateInboxTagInput,
} from "@/server/validators/inbox-tag.validator";

export async function getInboxTagsByCompany(companyId: string) {
  return prisma.inboxTag.findMany({
    where: {
      companyId,
    },
    orderBy: {
      name: "asc",
    },
  });
}

export async function createInboxTag(
  companyId: string,
  input: CreateInboxTagInput,
) {
  const existingTag = await prisma.inboxTag.findUnique({
    where: {
      companyId_name: {
        companyId,
        name: input.name,
      },
    },
  });

  if (existingTag) {
    throw new Error("Tag with this name already exists");
  }

  return prisma.inboxTag.create({
    data: {
      companyId,
      name: input.name,
      color: input.color,
    },
  });
}

export async function deleteInboxTag(companyId: string, tagId: string) {
  const tag = await prisma.inboxTag.findFirst({
    where: {
      id: tagId,
      companyId,
    },
  });

  if (!tag) {
    throw new Error("Tag not found");
  }

  await prisma.inboxTag.delete({
    where: {
      id: tag.id,
    },
  });

  return tag;
}

export async function addTagToConversation(
  companyId: string,
  contactId: string,
  input: AddConversationTagInput,
) {
  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      companyId,
    },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  const tag = await prisma.inboxTag.findFirst({
    where: {
      id: input.tagId,
      companyId,
    },
  });

  if (!tag) {
    throw new Error("Tag not found");
  }

  return prisma.contactInboxTag.upsert({
    where: {
      contactId_tagId: {
        contactId,
        tagId: tag.id,
      },
    },
    update: {},
    create: {
      companyId,
      contactId,
      tagId: tag.id,
    },
    include: {
      tag: true,
    },
  });
}

export async function removeTagFromConversation(
  companyId: string,
  contactId: string,
  tagId: string,
) {
  const contactTag = await prisma.contactInboxTag.findFirst({
    where: {
      companyId,
      contactId,
      tagId,
    },
    include: {
      tag: true,
    },
  });

  if (!contactTag) {
    throw new Error("Conversation tag not found");
  }

  await prisma.contactInboxTag.delete({
    where: {
      id: contactTag.id,
    },
  });

  return contactTag;
}
