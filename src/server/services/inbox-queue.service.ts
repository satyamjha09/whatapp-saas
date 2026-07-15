import { prisma } from "@/lib/prisma";
import { assignConversation } from "@/server/services/inbox-assignment.service";
import { toInboxSlug } from "@/server/services/inbox-skill.service";
import type {
  CreateInboxQueueInput,
  InboxQueueMemberInput,
  UpdateConversationQueueInput,
  UpdateInboxQueueInput,
} from "@/server/validators/inbox-queue.validator";

async function assertCompanyMember(companyId: string, userId: string) {
  const membership = await prisma.companyUser.findUnique({
    where: {
      userId_companyId: {
        userId,
        companyId,
      },
    },
  });

  if (!membership) {
    throw new Error("User is not a member of this company");
  }

  return membership;
}

async function assertCompanyQueue(companyId: string, queueId: string) {
  const queue = await prisma.inboxQueue.findFirst({
    where: {
      id: queueId,
      companyId,
    },
  });

  if (!queue) {
    throw new Error("Queue not found");
  }

  return queue;
}

export async function listInboxQueues(companyId: string) {
  return prisma.inboxQueue.findMany({
    where: { companyId },
    include: {
      fallbackQueue: true,
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              imageUrl: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { joinedAt: "asc" }],
      },
      requiredSkills: {
        include: {
          skill: true,
        },
      },
      _count: {
        select: {
          contacts: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

export async function createInboxQueue(
  companyId: string,
  input: CreateInboxQueueInput,
) {
  const slug = input.slug ?? toInboxSlug(input.name);

  if (!slug) {
    throw new Error("Queue slug is required");
  }

  if (input.fallbackQueueId) {
    await assertCompanyQueue(companyId, input.fallbackQueueId);
  }

  return prisma.inboxQueue.create({
    data: {
      companyId,
      name: input.name,
      slug,
      description: input.description,
      color: input.color,
      assignmentMode: input.assignmentMode,
      fallbackQueueId: input.fallbackQueueId,
      maxOpenPerAgent: input.maxOpenPerAgent,
      approvalRequired: input.approvalRequired,
    },
  });
}

export async function updateInboxQueue(
  companyId: string,
  queueId: string,
  input: UpdateInboxQueueInput,
) {
  const queue = await assertCompanyQueue(companyId, queueId);

  if (input.fallbackQueueId) {
    if (input.fallbackQueueId === queue.id) {
      throw new Error("Queue cannot fallback to itself");
    }

    await assertCompanyQueue(companyId, input.fallbackQueueId);
  }

  return prisma.inboxQueue.update({
    where: { id: queue.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.assignmentMode !== undefined ? { assignmentMode: input.assignmentMode } : {}),
      ...(input.fallbackQueueId !== undefined ? { fallbackQueueId: input.fallbackQueueId } : {}),
      ...(input.maxOpenPerAgent !== undefined ? { maxOpenPerAgent: input.maxOpenPerAgent } : {}),
      ...(input.approvalRequired !== undefined ? { approvalRequired: input.approvalRequired } : {}),
    },
  });
}

export async function disableInboxQueue(companyId: string, queueId: string) {
  const queue = await assertCompanyQueue(companyId, queueId);

  return prisma.inboxQueue.update({
    where: { id: queue.id },
    data: {
      status: "DISABLED",
    },
  });
}

export async function listInboxQueueMembers(companyId: string, queueId: string) {
  await assertCompanyQueue(companyId, queueId);

  return prisma.inboxQueueMember.findMany({
    where: {
      companyId,
      queueId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          imageUrl: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { joinedAt: "asc" }],
  });
}

export async function upsertInboxQueueMember(
  companyId: string,
  queueId: string,
  input: InboxQueueMemberInput,
) {
  await assertCompanyQueue(companyId, queueId);
  await assertCompanyMember(companyId, input.userId);

  return prisma.inboxQueueMember.upsert({
    where: {
      queueId_userId: {
        queueId,
        userId: input.userId,
      },
    },
    create: {
      companyId,
      queueId,
      userId: input.userId,
      role: input.role,
      acceptingNew: input.acceptingNew,
      maxOpenOverride: input.maxOpenOverride,
      sortOrder: input.sortOrder,
    },
    update: {
      role: input.role,
      acceptingNew: input.acceptingNew,
      maxOpenOverride: input.maxOpenOverride,
      sortOrder: input.sortOrder,
    },
    include: {
      user: {
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

export async function removeInboxQueueMember(
  companyId: string,
  queueId: string,
  userId: string,
) {
  await assertCompanyQueue(companyId, queueId);

  const member = await prisma.inboxQueueMember.findFirst({
    where: {
      companyId,
      queueId,
      userId,
    },
  });

  if (!member) {
    throw new Error("Queue member not found");
  }

  return prisma.inboxQueueMember.delete({
    where: {
      id: member.id,
    },
  });
}

export async function updateConversationQueue(
  companyId: string,
  contactId: string,
  input: UpdateConversationQueueInput,
  actorUserId?: string | null,
) {
  return assignConversation({
    actorUserId,
    companyId,
    contactId,
    queueId: input.inboxQueueId,
    reason: input.inboxQueueId ? "Manual queue move" : "Manual queue removal",
    source: "MANUAL",
  });
}
