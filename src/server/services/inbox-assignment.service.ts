import {
  InboxAssignmentMode,
  InboxAssignmentSource,
  InboxQueueStatus,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { publishInboxRealtimeEvent } from "@/server/realtime/inbox-events";
import { createAuditLog } from "@/server/services/audit.service";
import { selectAgentForQueue } from "@/server/services/inbox-agent-load.service";
import { recordContactActivity } from "@/server/services/contact-activity.service";

type AssignConversationInput = {
  assignedToUserId?: string | null;
  actorUserId?: string | null;
  companyId: string;
  contactId: string;
  metadata?: Prisma.InputJsonValue;
  queueId?: string | null;
  reason?: string | null;
  ruleId?: string | null;
  source: InboxAssignmentSource;
};

type AssignBestAgentInput = {
  actorUserId?: string | null;
  assignmentMode?: InboxAssignmentMode | null;
  companyId: string;
  contactId: string;
  metadata?: Prisma.InputJsonValue;
  queueId: string;
  reason?: string | null;
  requiredSkillIds?: string[];
  ruleId?: string | null;
  source: InboxAssignmentSource;
};

const contactAssignmentInclude = {
  assignedTo: {
    select: {
      email: true,
      id: true,
      imageUrl: true,
      name: true,
    },
  },
  inboxQueue: true,
} satisfies Prisma.ContactInclude;

async function assertAssignableUser({
  assignedToUserId,
  companyId,
  queueId,
}: {
  assignedToUserId: string;
  companyId: string;
  queueId?: string | null;
}) {
  const membership = await prisma.companyUser.findFirst({
    where: {
      companyId,
      userId: assignedToUserId,
    },
  });

  if (!membership) {
    throw new Error("Assigned user is not a member of this company");
  }

  if (!queueId) return;

  const queueMember = await prisma.inboxQueueMember.findFirst({
    where: {
      acceptingNew: true,
      companyId,
      queueId,
      userId: assignedToUserId,
    },
  });

  if (!queueMember) {
    throw new Error("Assigned user is not an active member of this queue");
  }
}

async function assertAssignableQueue({
  companyId,
  queueId,
}: {
  companyId: string;
  queueId: string;
}) {
  const queue = await prisma.inboxQueue.findFirst({
    where: {
      companyId,
      id: queueId,
    },
  });

  if (!queue) {
    throw new Error("Queue not found");
  }

  if (queue.status !== InboxQueueStatus.ACTIVE) {
    throw new Error("Disabled queue cannot receive new conversations");
  }

  return queue;
}

export async function assignConversation(input: AssignConversationInput) {
  return assignConversationWithRetry(input, 0);
}

async function assignConversationWithRetry(
  input: AssignConversationInput,
  attempt: number,
) {
  const contact = await prisma.contact.findFirst({
    where: {
      companyId: input.companyId,
      id: input.contactId,
    },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  const nextQueueId =
    input.queueId === undefined ? contact.inboxQueueId : input.queueId;
  const nextAssignedToUserId =
    input.assignedToUserId === undefined
      ? contact.assignedToUserId
      : input.assignedToUserId;

  if (nextQueueId) {
    await assertAssignableQueue({
      companyId: input.companyId,
      queueId: nextQueueId,
    });
  }

  if (nextAssignedToUserId) {
    await assertAssignableUser({
      assignedToUserId: nextAssignedToUserId,
      companyId: input.companyId,
      queueId: nextQueueId,
    });
  }

  const now = new Date();

  const result = await prisma.contact.updateMany({
    where: {
      companyId: input.companyId,
      id: contact.id,
      inboxAssignmentVersion: contact.inboxAssignmentVersion,
    },
    data: {
      assignedToUserId: nextAssignedToUserId,
      inboxAssignedAt: nextAssignedToUserId || nextQueueId ? now : null,
      inboxAssignmentSource: nextAssignedToUserId || nextQueueId ? input.source : null,
      inboxAssignmentVersion: {
        increment: 1,
      },
      inboxQueueId: nextQueueId,
    },
  });

  if (result.count === 0) {
    if (attempt >= 1) {
      throw new Error("Conversation assignment changed. Please retry.");
    }

    return assignConversationWithRetry(input, attempt + 1);
  }

  await prisma.$transaction(async (tx) => {
    await tx.inboxConversationAssignment.updateMany({
      where: {
        companyId: input.companyId,
        contactId: contact.id,
        unassignedAt: null,
      },
      data: {
        unassignedAt: now,
      },
    });

    await tx.inboxConversationAssignment.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        assignedAt: now,
        assignedToUserId: nextAssignedToUserId,
        companyId: input.companyId,
        contactId: contact.id,
        metadata: input.metadata ?? Prisma.JsonNull,
        previousQueueId: contact.inboxQueueId,
        previousUserId: contact.assignedToUserId,
        queueId: nextQueueId,
        reason: input.reason ?? null,
        ruleId: input.ruleId ?? null,
        source: input.source,
      },
    });

    if (nextAssignedToUserId) {
      await tx.inboxAgentProfile.upsert({
        where: {
          companyId_userId: {
            companyId: input.companyId,
            userId: nextAssignedToUserId,
          },
        },
        create: {
          companyId: input.companyId,
          lastAssignedAt: now,
          userId: nextAssignedToUserId,
        },
        update: {
          lastAssignedAt: now,
        },
      });
    }
  });

  const updatedContact = await prisma.contact.findUniqueOrThrow({
    where: {
      id: contact.id,
    },
    include: contactAssignmentInclude,
  });

  const isUnassigned = !nextAssignedToUserId && !nextQueueId;
  const title = isUnassigned
    ? "Conversation unassigned"
    : nextAssignedToUserId
      ? "Conversation assigned"
      : "Conversation routed to queue";

  await recordContactActivity({
    actorUserId: input.actorUserId,
    companyId: input.companyId,
    contactId: contact.id,
    metadata: {
      assignmentSource: input.source,
      assignmentVersion: updatedContact.inboxAssignmentVersion,
      nextAssignedToUserId,
      nextQueueId,
      previousAssignedToUserId: contact.assignedToUserId,
      previousQueueId: contact.inboxQueueId,
      reason: input.reason ?? null,
      ruleId: input.ruleId ?? null,
    },
    title,
    type: isUnassigned ? "UNASSIGNED" : "ASSIGNED",
  });

  await createAuditLog({
    action: isUnassigned
      ? "inbox.conversation.unassigned"
      : "inbox.conversation.assigned",
    actorUserId: input.actorUserId,
    companyId: input.companyId,
    entityId: contact.id,
    entityType: "Contact",
    metadata: {
      assignedToUserId: nextAssignedToUserId,
      queueId: nextQueueId,
      reason: input.reason ?? null,
      source: input.source,
    },
  });

  await publishInboxRealtimeEvent({
    assignedToUserId: nextAssignedToUserId,
    companyId: input.companyId,
    contactId: contact.id,
    createdAt: now.toISOString(),
    queueId: nextQueueId,
    source: input.source,
    type: "CONVERSATION_ASSIGNED",
  }).catch(() => undefined);

  return updatedContact;
}

export async function assignConversationToBestAgent(input: AssignBestAgentInput) {
  const queue = await assertAssignableQueue({
    companyId: input.companyId,
    queueId: input.queueId,
  });
  const assignmentMode = input.assignmentMode ?? queue.assignmentMode;

  if (assignmentMode === InboxAssignmentMode.MANUAL) {
    return assignConversation({
      actorUserId: input.actorUserId,
      companyId: input.companyId,
      contactId: input.contactId,
      metadata: input.metadata,
      queueId: queue.id,
      reason: input.reason,
      ruleId: input.ruleId,
      source: input.source,
    });
  }

  const selectedAgent = await selectAgentForQueue({
    assignmentMode,
    companyId: input.companyId,
    queueId: queue.id,
    requiredSkillIds: input.requiredSkillIds,
  });

  return assignConversation({
    actorUserId: input.actorUserId,
    assignedToUserId: selectedAgent?.userId ?? null,
    companyId: input.companyId,
    contactId: input.contactId,
    metadata: input.metadata,
    queueId: queue.id,
    reason: input.reason,
    ruleId: input.ruleId,
    source:
      input.source === InboxAssignmentSource.ROUTING_RULE
        ? InboxAssignmentSource.ROUTING_RULE
        : assignmentMode === InboxAssignmentMode.ROUND_ROBIN
          ? InboxAssignmentSource.ROUND_ROBIN
          : InboxAssignmentSource.LOAD_BASED,
  });
}
