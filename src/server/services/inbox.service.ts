import { prisma } from "@/lib/prisma";
import { UpdateConversationStatusInput } from "@/server/validators/inbox-status.validator";

export async function getInboxContactsByCompany(companyId: string) {
  const contacts = await prisma.contact.findMany({
    where: {
      companyId,
      messages: {
        some: {
          companyId,
        },
      },
    },
    include: {
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
