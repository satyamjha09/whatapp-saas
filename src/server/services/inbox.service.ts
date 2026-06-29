import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ContactActivityType, Prisma } from "@/generated/prisma/client";
import {
  DEFAULT_INBOX_SLA_SETTINGS,
  isInboxConversationOverdue,
} from "@/lib/inbox-sla";
import type {
  InboxFilter,
  InboxPriorityFilter,
  InboxSort,
} from "@/lib/inbox-options";
import { calculateInboxSlaDueAt } from "@/server/services/inbox-sla.service";
import { queueLeadScoreRecalculation } from "@/server/services/lead-scoring.service";
import { recordContactActivity } from "@/server/services/contact-activity.service";
import {
  CreateInboxNoteInput,
  UpdateInboxNoteInput,
} from "@/server/validators/inbox-note.validator";
import { UpdateConversationPriorityInput } from "@/server/validators/inbox-priority.validator";
import { UpdateConversationSnoozeInput } from "@/server/validators/inbox-snooze.validator";
import { UpdateConversationStatusInput } from "@/server/validators/inbox-status.validator";
import { UpdateConversationAssigneeInput } from "@/server/validators/inbox-assignee.validator";
import type { BulkInboxActionInput } from "@/server/validators/inbox-bulk-action.validator";

type GetInboxContactsInput = {
  filter?: InboxFilter;
  currentUserId?: string;
  search?: string;
  tagId?: string;
  priority?: InboxPriorityFilter;
  sort?: InboxSort;
  page?: number;
  pageSize?: number;
  sla?: string | null;
};

export async function getInboxContactsByCompany(
  companyId: string,
  input: GetInboxContactsInput = {},
) {
  const filter = input.filter ?? "all";
  const priority = input.priority ?? "all";
  const sort = input.sort ?? "latest";
  const page = Math.max(input.page ?? 1, 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 50);
  const search = input.search?.trim();
  const now = new Date();
  const inboxSlaSettings = await getInboxSlaSettingsByCompany(companyId);

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
    ...(filter === "snoozed"
      ? {
          snoozedUntil: {
            gt: now,
          },
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
    ...(input.tagId
      ? {
          inboxTags: {
            some: {
              tagId: input.tagId,
              companyId,
            },
          },
        }
      : {}),
    ...(priority !== "all"
      ? {
          inboxPriority: priority,
        }
      : {}),
    AND: [
      ...(filter === "open"
        ? [
            {
              OR: [
                {
                  snoozedUntil: null,
                },
                {
                  snoozedUntil: {
                    lte: now,
                  },
                },
              ],
            },
          ]
        : []),
      ...(search
        ? [
            {
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
            },
          ]
        : []),
    ],
  };

  if (input.sla === "overdue") {
    where.inboxStatus = "OPEN";
    where.inboxSlaDueAt = {
      lt: now,
    };
  }

  if (input.sla === "due-soon") {
    where.inboxStatus = "OPEN";
    where.inboxSlaDueAt = {
      gte: now,
      lte: new Date(now.getTime() + 30 * 60 * 1000),
    };
  }

  if (input.sla === "breached") {
    where.inboxStatus = "OPEN";
    where.inboxSlaBreachedAt = {
      not: null,
    };
  }

  const contacts = await prisma.contact.findMany({
    where,
    include: {
      assignedTo: true,
      inboxTags: {
        include: {
          tag: true,
        },
      },
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
    orderBy: [
      {
        inboxSlaDueAt: "asc",
      },
      {
        updatedAt: "desc",
      },
    ],
  });

  const filteredContacts = contacts.filter((contact) => {
    const latestMessage = contact.messages[0];

    if (filter === "needs-reply") {
      if (!latestMessage) {
        return false;
      }

      const isSnoozed = contact.snoozedUntil && contact.snoozedUntil > now;

      return (
        latestMessage.direction === "INBOUND" &&
        contact.inboxStatus === "OPEN" &&
        !isSnoozed
      );
    }

    if (filter === "overdue") {
      if (!latestMessage) {
        return false;
      }

      return isInboxConversationOverdue({
        latestMessageCreatedAt: latestMessage.createdAt,
        latestMessageDirection: latestMessage.direction,
        inboxStatus: contact.inboxStatus,
        inboxPriority: contact.inboxPriority,
        snoozedUntil: contact.snoozedUntil,
        slaSettings: inboxSlaSettings,
      });
    }

    return true;
  });

  const priorityRank = {
    URGENT: 4,
    HIGH: 3,
    NORMAL: 2,
    LOW: 1,
  };

  const sortedContacts = filteredContacts.sort((a, b) => {
    const aDate = a.messages[0]?.createdAt.getTime() ?? 0;
    const bDate = b.messages[0]?.createdAt.getTime() ?? 0;
    const aUnread = a._count.messages;
    const bUnread = b._count.messages;

    if (sort === "oldest") {
      return aDate - bDate;
    }

    if (sort === "priority") {
      const priorityDiff =
        priorityRank[b.inboxPriority] - priorityRank[a.inboxPriority];

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      return bDate - aDate;
    }

    if (sort === "unread") {
      const unreadDiff = bUnread - aUnread;

      if (unreadDiff !== 0) {
        return unreadDiff;
      }

      return bDate - aDate;
    }

    return bDate - aDate;
  });

  const total = sortedContacts.length;
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const boundedPage = Math.min(page, totalPages);
  const start = (boundedPage - 1) * pageSize;
  const end = start + pageSize;

  return {
    contacts: sortedContacts.slice(start, end),
    pagination: {
      page: boundedPage,
      pageSize,
      total,
      totalPages,
      hasPreviousPage: boundedPage > 1,
      hasNextPage: boundedPage < totalPages,
    },
  };
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
  const conversation = await prisma.contact.findFirst({
    where: {
      id: contactId,
      companyId,
    },
    include: {
      assignedTo: true,
      inboxTags: {
        include: {
          tag: true,
        },
      },
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
          createdAt: "desc",
        },
        take: 50,
      },
      _count: {
        select: {
          messages: {
            where: {
              companyId,
            },
          },
        },
      },
    },
  });

  if (!conversation) {
    return null;
  }

  return {
    ...conversation,
    messages: [...conversation.messages].reverse(),
  };
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

  const note = await prisma.inboxNote.create({
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

  await recordContactActivity({
    companyId,
    contactId,
    actorUserId: authorUserId,
    type: "NOTE_CREATED",
    title: "Internal note created",
    description: note.body,
    metadata: {
      noteId: note.id,
    },
  });

  return note;
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

  const updatedNote = await prisma.inboxNote.update({
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

  await recordContactActivity({
    companyId,
    contactId,
    actorUserId: note.authorUserId,
    type: "NOTE_UPDATED",
    title: "Internal note updated",
    description: updatedNote.body,
    metadata: {
      noteId: updatedNote.id,
    },
  });

  return updatedNote;
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

  await recordContactActivity({
    companyId,
    contactId,
    actorUserId: note.authorUserId,
    type: "NOTE_DELETED",
    title: "Internal note deleted",
    metadata: {
      noteId: note.id,
    },
  });

  return note;
}

export async function updateConversationStatus(
  companyId: string,
  contactId: string,
  input: UpdateConversationStatusInput,
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

  const slaDueAt =
    input.status === "CLOSED"
      ? null
      : calculateInboxSlaDueAt(contact.inboxPriority);

  const updatedContact = await prisma.contact.update({
    where: {
      id: contact.id,
    },
    data: {
      inboxStatus: input.status,
      inboxClosedAt: input.status === "CLOSED" ? new Date() : null,
      inboxSlaDueAt: slaDueAt,
      inboxSlaBreachedAt: null,
      inboxSlaEscalationCount: 0,
    },
  });

  await recordContactActivity({
    companyId,
    contactId,
    actorUserId,
    type: "STATUS_CHANGED",
    title: `Conversation ${input.status.toLowerCase()}`,
    metadata: {
      previousStatus: contact.inboxStatus,
      nextStatus: updatedContact.inboxStatus,
    },
  });

  return updatedContact;
}

export async function updateConversationPriority(
  companyId: string,
  contactId: string,
  input: UpdateConversationPriorityInput,
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

  const slaDueAt =
    contact.inboxStatus === "CLOSED"
      ? null
      : calculateInboxSlaDueAt(input.priority);

  const updatedContact = await prisma.contact.update({
    where: {
      id: contact.id,
    },
    data: {
      inboxPriority: input.priority,
      inboxSlaDueAt: slaDueAt,
      inboxSlaBreachedAt: null,
      inboxSlaEscalationCount: 0,
    },
  });

  await recordContactActivity({
    companyId,
    contactId,
    actorUserId,
    type: "PRIORITY_CHANGED",
    title: "Priority changed",
    metadata: {
      previousPriority: contact.inboxPriority,
      nextPriority: updatedContact.inboxPriority,
    },
  });

  await queueLeadScoreRecalculation(companyId, contactId).catch(() => undefined);

  return updatedContact;
}

export async function updateConversationAssignee(
  companyId: string,
  contactId: string,
  input: UpdateConversationAssigneeInput,
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

  if (input.assignedToUserId) {
    const membership = await prisma.companyUser.findFirst({
      where: {
        companyId,
        userId: input.assignedToUserId,
      },
    });

    if (!membership) {
      throw new Error("Assigned user is not a member of this company");
    }
  }

  const updatedContact = await prisma.contact.update({
    where: {
      id: contact.id,
    },
    data: {
      assignedToUserId: input.assignedToUserId,
    },
    include: {
      assignedTo: true,
    },
  });

  await recordContactActivity({
    companyId,
    contactId,
    actorUserId,
    type: input.assignedToUserId ? "ASSIGNED" : "UNASSIGNED",
    title: input.assignedToUserId
      ? "Conversation assigned"
      : "Conversation unassigned",
    metadata: {
      previousAssignedToUserId: contact.assignedToUserId,
      assignedToUserId: input.assignedToUserId,
    },
  });

  return updatedContact;
}

type BulkInboxActionResult = {
  count: number;
  messageCount: number | null;
  action: BulkInboxActionInput["action"];
  status: "OPEN" | "CLOSED" | null;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT" | null;
  assignedToUserId: string | null;
  tagId: string | null;
  tagName: string | null;
  snoozedUntil: Date | null;
  contactIds: string[];
};

function createBulkInboxActionResult(input: {
  count: number;
  action: BulkInboxActionInput["action"];
  contactIds: string[];
  messageCount?: number | null;
  status?: "OPEN" | "CLOSED" | null;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT" | null;
  assignedToUserId?: string | null;
  tagId?: string | null;
  tagName?: string | null;
  snoozedUntil?: Date | null;
}): BulkInboxActionResult {
  return {
    count: input.count,
    messageCount: input.messageCount ?? null,
    action: input.action,
    status: input.status ?? null,
    priority: input.priority ?? null,
    assignedToUserId: input.assignedToUserId ?? null,
    tagId: input.tagId ?? null,
    tagName: input.tagName ?? null,
    snoozedUntil: input.snoozedUntil ?? null,
    contactIds: input.contactIds,
  };
}

type BulkActivityContact = {
  id: string;
  assignedToUserId: string | null;
  inboxPriority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  inboxStatus: "OPEN" | "CLOSED";
};

async function recordBulkContactActivities({
  companyId,
  actorUserId,
  contacts,
  type,
  title,
  metadataForContact,
}: {
  companyId: string;
  actorUserId?: string | null;
  contacts: BulkActivityContact[];
  type: ContactActivityType;
  title: string;
  metadataForContact: (contact: BulkActivityContact) => unknown;
}) {
  if (contacts.length === 0) {
    return;
  }

  await prisma.contactActivity.createMany({
    data: contacts.map((contact) => ({
      companyId,
      contactId: contact.id,
      actorUserId: actorUserId ?? null,
      type,
      title,
      metadata: metadataForContact(contact) as Prisma.InputJsonValue,
    })),
  });
}

export async function bulkUpdateInboxConversations(
  companyId: string,
  input: BulkInboxActionInput,
  actorUserId?: string | null,
): Promise<BulkInboxActionResult> {
  const contacts = await prisma.contact.findMany({
    where: {
      companyId,
      id: {
        in: input.contactIds,
      },
    },
    select: {
      id: true,
      assignedToUserId: true,
      inboxPriority: true,
      inboxStatus: true,
    },
  });

  if (contacts.length === 0) {
    throw new Error("No valid conversations found");
  }

  const validContactIds = contacts.map((contact) => contact.id);
  const now = new Date();

  if (input.action === "SET_STATUS") {
    const status = input.status!;

    if (status === "CLOSED") {
      const result = await prisma.contact.updateMany({
        where: {
          companyId,
          id: {
            in: validContactIds,
          },
        },
        data: {
          inboxStatus: status,
          inboxClosedAt: now,
          inboxSlaDueAt: null,
          inboxSlaBreachedAt: null,
          inboxSlaEscalationCount: 0,
        },
      });

      await recordBulkContactActivities({
        companyId,
        actorUserId,
        contacts,
        type: "STATUS_CHANGED",
        title: "Conversation closed",
        metadataForContact: (contact) => ({
          previousStatus: contact.inboxStatus,
          nextStatus: status,
        }),
      });

      return createBulkInboxActionResult({
        count: result.count,
        action: input.action,
        status,
        contactIds: validContactIds,
      });
    }

    await prisma.$transaction(
      contacts.map((contact) =>
        prisma.contact.update({
          where: {
            id: contact.id,
          },
          data: {
            inboxStatus: status,
            inboxClosedAt: null,
            inboxSlaDueAt: calculateInboxSlaDueAt(contact.inboxPriority, now),
            inboxSlaBreachedAt: null,
            inboxSlaEscalationCount: 0,
          },
        }),
      ),
    );

    await recordBulkContactActivities({
      companyId,
      actorUserId,
      contacts,
      type: "STATUS_CHANGED",
      title: "Conversation opened",
      metadataForContact: (contact) => ({
        previousStatus: contact.inboxStatus,
        nextStatus: status,
      }),
    });

    return createBulkInboxActionResult({
      count: contacts.length,
      action: input.action,
      status,
      contactIds: validContactIds,
    });
  }

  if (input.action === "SET_PRIORITY") {
    const priority = input.priority!;
    const openContactIds = contacts
      .filter((contact) => contact.inboxStatus === "OPEN")
      .map((contact) => contact.id);
    const closedContactIds = contacts
      .filter((contact) => contact.inboxStatus === "CLOSED")
      .map((contact) => contact.id);

    const [openResult, closedResult] = await prisma.$transaction([
      prisma.contact.updateMany({
        where: {
          companyId,
          id: {
            in: openContactIds,
          },
        },
        data: {
          inboxPriority: priority,
          inboxSlaDueAt: calculateInboxSlaDueAt(priority, now),
          inboxSlaBreachedAt: null,
          inboxSlaEscalationCount: 0,
        },
      }),
      prisma.contact.updateMany({
        where: {
          companyId,
          id: {
            in: closedContactIds,
          },
        },
        data: {
          inboxPriority: priority,
          inboxSlaDueAt: null,
          inboxSlaBreachedAt: null,
          inboxSlaEscalationCount: 0,
        },
      }),
    ]);

    await recordBulkContactActivities({
      companyId,
      actorUserId,
      contacts,
      type: "PRIORITY_CHANGED",
      title: "Priority changed",
      metadataForContact: (contact) => ({
        previousPriority: contact.inboxPriority,
        nextPriority: priority,
      }),
    });

    return createBulkInboxActionResult({
      count: openResult.count + closedResult.count,
      action: input.action,
      priority,
      contactIds: validContactIds,
    });
  }

  if (input.action === "SET_ASSIGNEE") {
    const assignedToUserId = input.assignedToUserId ?? null;

    if (assignedToUserId) {
      const membership = await prisma.companyUser.findFirst({
        where: {
          companyId,
          userId: assignedToUserId,
        },
      });

      if (!membership) {
        throw new Error("Assigned user is not a member of this company");
      }
    }

    const result = await prisma.contact.updateMany({
      where: {
        companyId,
        id: {
          in: validContactIds,
        },
      },
      data: {
        assignedToUserId,
      },
    });

    await recordBulkContactActivities({
      companyId,
      actorUserId,
      contacts,
      type: assignedToUserId ? "ASSIGNED" : "UNASSIGNED",
      title: assignedToUserId
        ? "Conversation assigned"
        : "Conversation unassigned",
      metadataForContact: (contact) => ({
        previousAssignedToUserId: contact.assignedToUserId,
        assignedToUserId,
      }),
    });

    return createBulkInboxActionResult({
      count: result.count,
      action: input.action,
      assignedToUserId,
      contactIds: validContactIds,
    });
  }

  if (input.action === "MARK_READ") {
    const result = await prisma.message.updateMany({
      where: {
        companyId,
        contactId: {
          in: validContactIds,
        },
        direction: "INBOUND",
        inboxReadAt: null,
      },
      data: {
        inboxReadAt: now,
      },
    });

    return createBulkInboxActionResult({
      count: validContactIds.length,
      messageCount: result.count,
      action: input.action,
      contactIds: validContactIds,
    });
  }

  if (input.action === "MARK_UNREAD") {
    const result = await prisma.message.updateMany({
      where: {
        companyId,
        contactId: {
          in: validContactIds,
        },
        direction: "INBOUND",
        inboxReadAt: {
          not: null,
        },
      },
      data: {
        inboxReadAt: null,
      },
    });

    return createBulkInboxActionResult({
      count: validContactIds.length,
      messageCount: result.count,
      action: input.action,
      contactIds: validContactIds,
    });
  }

  if (input.action === "SNOOZE") {
    const snoozedUntil = new Date(input.snoozedUntil!);

    if (snoozedUntil <= now) {
      throw new Error("Snooze time must be in the future");
    }

    const result = await prisma.contact.updateMany({
      where: {
        companyId,
        id: {
          in: validContactIds,
        },
      },
      data: {
        inboxStatus: "OPEN",
        inboxClosedAt: null,
        snoozedUntil,
      },
    });

    await recordBulkContactActivities({
      companyId,
      actorUserId,
      contacts,
      type: "SNOOZED",
      title: "Conversation snoozed",
      metadataForContact: () => ({
        snoozedUntil,
      }),
    });

    return createBulkInboxActionResult({
      count: result.count,
      action: input.action,
      snoozedUntil,
      contactIds: validContactIds,
    });
  }

  if (input.action === "UNSNOOZE") {
    const result = await prisma.contact.updateMany({
      where: {
        companyId,
        id: {
          in: validContactIds,
        },
      },
      data: {
        snoozedUntil: null,
      },
    });

    await recordBulkContactActivities({
      companyId,
      actorUserId,
      contacts,
      type: "UNSNOOZED",
      title: "Conversation unsnoozed",
      metadataForContact: () => ({
        snoozedUntil: null,
      }),
    });

    return createBulkInboxActionResult({
      count: result.count,
      action: input.action,
      contactIds: validContactIds,
    });
  }

  const tag = await prisma.inboxTag.findFirst({
    where: {
      id: input.tagId!,
      companyId,
    },
  });

  if (!tag) {
    throw new Error("Tag not found");
  }

  if (input.action === "ADD_TAG") {
    await prisma.contactInboxTag.createMany({
      data: validContactIds.map((contactId) => ({
        companyId,
        contactId,
        tagId: tag.id,
      })),
      skipDuplicates: true,
    });

    await recordBulkContactActivities({
      companyId,
      actorUserId,
      contacts,
      type: "TAG_ADDED",
      title: "Tag added",
      metadataForContact: () => ({
        tagId: tag.id,
        tagName: tag.name,
      }),
    });

    return createBulkInboxActionResult({
      count: validContactIds.length,
      action: input.action,
      tagId: tag.id,
      tagName: tag.name,
      contactIds: validContactIds,
    });
  }

  const result = await prisma.contactInboxTag.deleteMany({
    where: {
      companyId,
      contactId: {
        in: validContactIds,
      },
      tagId: tag.id,
    },
  });

  await recordBulkContactActivities({
    companyId,
    actorUserId,
    contacts,
    type: "TAG_REMOVED",
    title: "Tag removed",
    metadataForContact: () => ({
      tagId: tag.id,
      tagName: tag.name,
    }),
  });

  return createBulkInboxActionResult({
    count: result.count,
    action: input.action,
    tagId: tag.id,
    tagName: tag.name,
    contactIds: validContactIds,
  });
}

export async function updateConversationSnooze(
  companyId: string,
  contactId: string,
  input: UpdateConversationSnoozeInput,
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

  const snoozedUntil = input.snoozedUntil
    ? new Date(input.snoozedUntil)
    : null;

  if (snoozedUntil && snoozedUntil <= new Date()) {
    throw new Error("Snooze time must be in the future");
  }

  const updatedContact = await prisma.contact.update({
    where: {
      id: contact.id,
    },
    data: {
      snoozedUntil,
      inboxStatus: snoozedUntil ? "OPEN" : contact.inboxStatus,
      inboxClosedAt: snoozedUntil ? null : contact.inboxClosedAt,
    },
  });

  await recordContactActivity({
    companyId,
    contactId,
    actorUserId,
    type: snoozedUntil ? "SNOOZED" : "UNSNOOZED",
    title: snoozedUntil ? "Conversation snoozed" : "Conversation unsnoozed",
    metadata: {
      previousSnoozedUntil: contact.snoozedUntil,
      snoozedUntil: updatedContact.snoozedUntil,
    },
  });

  return updatedContact;
}

export const getInboxSlaSettingsByCompany = unstable_cache(
  async function getInboxSlaSettingsByCompany(companyId: string) {
  await prisma.company.findUnique({
    where: {
      id: companyId,
    },
    select: {
      id: true,
    },
  });

  return DEFAULT_INBOX_SLA_SETTINGS;
  },
  ["inbox-sla-settings-by-company"],
  {
    revalidate: 300,
    tags: ["inbox-sla-settings"],
  },
);

export async function getInboxStatsByCompany(
  companyId: string,
  currentUserId: string,
) {
  const now = new Date();
  const inboxSlaSettings = await getInboxSlaSettingsByCompany(companyId);
  const baseContactWhere: Prisma.ContactWhereInput = {
    companyId,
    messages: {
      some: {
        companyId,
      },
    },
  };

  const [
    totalConversations,
    openConversations,
    closedConversations,
    snoozedConversations,
    unreadConversations,
    unreadMessages,
    urgentConversations,
    assignedToMeConversations,
    unassignedConversations,
    inboundLatestCandidates,
  ] = await prisma.$transaction([
    prisma.contact.count({
      where: baseContactWhere,
    }),
    prisma.contact.count({
      where: {
        ...baseContactWhere,
        inboxStatus: "OPEN",
        OR: [
          {
            snoozedUntil: null,
          },
          {
            snoozedUntil: {
              lte: now,
            },
          },
        ],
      },
    }),
    prisma.contact.count({
      where: {
        ...baseContactWhere,
        inboxStatus: "CLOSED",
      },
    }),
    prisma.contact.count({
      where: {
        ...baseContactWhere,
        snoozedUntil: {
          gt: now,
        },
      },
    }),
    prisma.contact.count({
      where: {
        ...baseContactWhere,
        messages: {
          some: {
            companyId,
            direction: "INBOUND",
            inboxReadAt: null,
          },
        },
      },
    }),
    prisma.message.count({
      where: {
        companyId,
        direction: "INBOUND",
        inboxReadAt: null,
      },
    }),
    prisma.contact.count({
      where: {
        ...baseContactWhere,
        inboxPriority: "URGENT",
      },
    }),
    prisma.contact.count({
      where: {
        ...baseContactWhere,
        assignedToUserId: currentUserId,
      },
    }),
    prisma.contact.count({
      where: {
        ...baseContactWhere,
        assignedToUserId: null,
      },
    }),
    prisma.contact.findMany({
      where: {
        ...baseContactWhere,
        inboxStatus: "OPEN",
        OR: [
          {
            snoozedUntil: null,
          },
          {
            snoozedUntil: {
              lte: now,
            },
          },
        ],
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
      },
    }),
  ]);

  const needsReplyConversations = inboundLatestCandidates.filter((contact) => {
    const latestMessage = contact.messages[0];

    return latestMessage?.direction === "INBOUND";
  }).length;

  const overdueConversations = inboundLatestCandidates.filter((contact) => {
    const latestMessage = contact.messages[0];

    if (!latestMessage) {
      return false;
    }

    return isInboxConversationOverdue({
      latestMessageCreatedAt: latestMessage.createdAt,
      latestMessageDirection: latestMessage.direction,
      inboxStatus: contact.inboxStatus,
      inboxPriority: contact.inboxPriority,
      snoozedUntil: contact.snoozedUntil,
      slaSettings: inboxSlaSettings,
    });
  }).length;

  return {
    totalConversations,
    openConversations,
    closedConversations,
    snoozedConversations,
    unreadConversations,
    unreadMessages,
    urgentConversations,
    assignedToMeConversations,
    unassignedConversations,
    needsReplyConversations,
    overdueConversations,
  };
}
