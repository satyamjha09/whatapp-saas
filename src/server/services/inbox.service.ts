import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  CreateInboxNoteInput,
  UpdateInboxNoteInput,
} from "@/server/validators/inbox-note.validator";
import { UpdateConversationStatusInput } from "@/server/validators/inbox-status.validator";

export type InboxFilter =
  | "all"
  | "open"
  | "closed"
  | "assigned-to-me"
  | "unassigned";

type GetInboxContactsInput = {
  filter?: InboxFilter;
  currentUserId?: string;
  search?: string;
};

export const inboxFilters: InboxFilter[] = [
  "all",
  "open",
  "closed",
  "assigned-to-me",
  "unassigned",
];

export function resolveInboxFilter(filter: string | undefined): InboxFilter {
  if (inboxFilters.includes(filter as InboxFilter)) {
    return filter as InboxFilter;
  }

  return "all";
}

export async function getInboxContactsByCompany(
  companyId: string,
  input: GetInboxContactsInput = {},
) {
  const filter = input.filter ?? "all";
  const search = input.search?.trim();

  const where: Prisma.ContactWhereInput = {
    companyId,
    messages: {
      some: {
        companyId,
      },
    },
    ...(filter === "open"
      ? {
          inboxStatus: "OPEN" as const,
        }
      : {}),
    ...(filter === "closed"
      ? {
          inboxStatus: "CLOSED" as const,
        }
      : {}),
    ...(filter === "assigned-to-me" && input.currentUserId
      ? {
          assignedToUserId: input.currentUserId,
        }
      : {}),
    ...(filter === "unassigned"
      ? {
          assignedToUserId: null,
        }
      : {}),
    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              phoneNumber: {
                contains: search,
              },
            },
            {
              countryCode: {
                contains: search,
              },
            },
            {
              messages: {
                some: {
                  companyId,
                  body: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  const contacts = await prisma.contact.findMany({
    where,
    include: {
      assignedTo: true,
      messages: {
        where: {
          companyId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
      _count: {
        select: {
          messages: {
            where: {
              companyId,
              direction: "INBOUND",
              inboxReadAt: null,
            },
          },
        },
      },
    },
  });

  return contacts.sort((a, b) => {
    const aDate = a.messages[0]?.createdAt.getTime() ?? 0;
    const bDate = b.messages[0]?.createdAt.getTime() ?? 0;

    return bDate - aDate;
  });
}

export async function markConversationAsRead(
  companyId: string,
  contactId: string,
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

  return prisma.message.updateMany({
    where: {
      companyId,
      contactId,
      direction: "INBOUND",
      inboxReadAt: null,
    },
    data: {
      inboxReadAt: new Date(),
    },
  });
}

export async function getConversationByContact(
  companyId: string,
  contactId: string,
) {
  return prisma.contact.findFirst({
    where: {
      id: contactId,
      companyId,
    },
    include: {
      assignedTo: true,
      inboxNotes: {
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              imageUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      messages: {
        where: {
          companyId,
        },
        include: {
          template: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}

export async function createInboxNote(
  companyId: string,
  contactId: string,
  authorUserId: string,
  input: CreateInboxNoteInput,
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

  return prisma.inboxNote.create({
    data: {
      companyId,
      contactId,
      authorUserId,
      body: input.body,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
        },
      },
    },
  });
}

export async function updateInboxNote(
  companyId: string,
  contactId: string,
  noteId: string,
  input: UpdateInboxNoteInput,
) {
  const note = await prisma.inboxNote.findFirst({
    where: {
      id: noteId,
      companyId,
      contactId,
    },
  });

  if (!note) {
    throw new Error("Note not found");
  }

  return prisma.inboxNote.update({
    where: {
      id: note.id,
    },
    data: {
      body: input.body,
    },
    include: {
      author: {
        select: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
        },
      },
    },
  });
}

export async function deleteInboxNote(
  companyId: string,
  contactId: string,
  noteId: string,
) {
  const note = await prisma.inboxNote.findFirst({
    where: {
      id: noteId,
      companyId,
      contactId,
    },
  });

  if (!note) {
    throw new Error("Note not found");
  }

  await prisma.inboxNote.delete({
    where: {
      id: note.id,
    },
  });

  return note;
}

export async function updateConversationStatus(
  companyId: string,
  contactId: string,
  input: UpdateConversationStatusInput,
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

  return prisma.contact.update({
    where: {
      id: contact.id,
    },
    data: {
      inboxStatus: input.status,
      inboxClosedAt: input.status === "CLOSED" ? new Date() : null,
    },
  });
}
