import { revalidateTag, unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordContactActivity } from "@/server/services/contact-activity.service";
import {
  AddConversationTagInput,
  CreateInboxTagInput,
} from "@/server/validators/inbox-tag.validator";

const INBOX_TAGS_CACHE_TAG = "inbox-tags";

export const getInboxTagsByCompany = unstable_cache(
  async function getInboxTagsByCompany(companyId: string) {
  return prisma.inboxTag.findMany({
    where: {
      companyId,
    },
    orderBy: {
      name: "asc",
    },
  });
  },
  ["inbox-tags-by-company"],
  {
    revalidate: 60,
    tags: [INBOX_TAGS_CACHE_TAG],
  },
);

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

  const tag = await prisma.inboxTag.create({
    data: {
      companyId,
      name: input.name,
      color: input.color,
    },
  });

  revalidateTag(INBOX_TAGS_CACHE_TAG, "max");

  return tag;
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

  revalidateTag(INBOX_TAGS_CACHE_TAG, "max");

  return tag;
}

export async function addTagToConversation(
  companyId: string,
  contactId: string,
  input: AddConversationTagInput,
  actorUserId?: string | null,
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

  const contactTag = await prisma.contactInboxTag.upsert({
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

  revalidateTag(INBOX_TAGS_CACHE_TAG, "max");

  await recordContactActivity({
    companyId,
    contactId,
    actorUserId,
    type: "TAG_ADDED",
    title: "Tag added",
    metadata: {
      tagId: tag.id,
      tagName: tag.name,
    },
  });

  return contactTag;
}

export async function removeTagFromConversation(
  companyId: string,
  contactId: string,
  tagId: string,
  actorUserId?: string | null,
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

  revalidateTag(INBOX_TAGS_CACHE_TAG, "max");

  await recordContactActivity({
    companyId,
    contactId,
    actorUserId,
    type: "TAG_REMOVED",
    title: "Tag removed",
    metadata: {
      tagId: contactTag.tagId,
      tagName: contactTag.tag.name,
    },
  });

  return contactTag;
}
