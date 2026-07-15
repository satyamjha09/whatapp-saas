import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  CreateInboxRoutingRuleInput,
  UpdateInboxRoutingRuleInput,
} from "@/server/validators/inbox-routing-rule.validator";

const routingRuleInclude = {
  fallbackQueue: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
  targetQueue: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
} satisfies Prisma.InboxRoutingRuleInclude;

async function assertQueueBelongsToCompany({
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

  return queue;
}

async function assertSkillsBelongToCompany({
  companyId,
  skillIds,
}: {
  companyId: string;
  skillIds: string[];
}) {
  if (skillIds.length === 0) return;

  const count = await prisma.inboxSkill.count({
    where: {
      companyId,
      id: {
        in: skillIds,
      },
    },
  });

  if (count !== new Set(skillIds).size) {
    throw new Error("One or more routing skills were not found");
  }
}

async function validateRoutingRuleReferences({
  companyId,
  fallbackQueueId,
  requiredSkillIds = [],
  targetQueueId,
}: {
  companyId: string;
  fallbackQueueId?: string | null;
  requiredSkillIds?: string[];
  targetQueueId: string;
}) {
  await assertQueueBelongsToCompany({ companyId, queueId: targetQueueId });

  if (fallbackQueueId) {
    await assertQueueBelongsToCompany({ companyId, queueId: fallbackQueueId });
  }

  await assertSkillsBelongToCompany({ companyId, skillIds: requiredSkillIds });
}

export async function listInboxRoutingRules(companyId: string) {
  return prisma.inboxRoutingRule.findMany({
    where: {
      companyId,
    },
    include: routingRuleInclude,
    orderBy: [
      {
        priority: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
  });
}

export async function getInboxRoutingRule(companyId: string, ruleId: string) {
  const rule = await prisma.inboxRoutingRule.findFirst({
    where: {
      companyId,
      id: ruleId,
    },
    include: routingRuleInclude,
  });

  if (!rule) {
    throw new Error("Routing rule not found");
  }

  return rule;
}

export async function createInboxRoutingRule(
  companyId: string,
  input: CreateInboxRoutingRuleInput,
) {
  await validateRoutingRuleReferences({
    companyId,
    fallbackQueueId: input.fallbackQueueId,
    requiredSkillIds: input.requiredSkillIds,
    targetQueueId: input.targetQueueId,
  });

  return prisma.inboxRoutingRule.create({
    data: {
      assignmentMode: input.assignmentMode ?? null,
      companyId,
      conditions: input.conditions as Prisma.InputJsonValue,
      fallbackQueueId: input.fallbackQueueId ?? null,
      name: input.name,
      priority: input.priority,
      requiredSkillIds: input.requiredSkillIds ?? Prisma.JsonNull,
      status: input.status,
      targetQueueId: input.targetQueueId,
    },
    include: routingRuleInclude,
  });
}

export async function updateInboxRoutingRule(
  companyId: string,
  ruleId: string,
  input: UpdateInboxRoutingRuleInput,
) {
  const existing = await getInboxRoutingRule(companyId, ruleId);

  const targetQueueId = input.targetQueueId ?? existing.targetQueueId;
  const fallbackQueueId =
    input.fallbackQueueId === undefined
      ? existing.fallbackQueueId
      : input.fallbackQueueId;
  const requiredSkillIds =
    input.requiredSkillIds ??
    (Array.isArray(existing.requiredSkillIds)
      ? existing.requiredSkillIds.filter((value): value is string => typeof value === "string")
      : []);

  await validateRoutingRuleReferences({
    companyId,
    fallbackQueueId,
    requiredSkillIds,
    targetQueueId,
  });

  return prisma.inboxRoutingRule.update({
    where: {
      id: existing.id,
    },
    data: {
      ...(input.assignmentMode !== undefined
        ? { assignmentMode: input.assignmentMode }
        : {}),
      ...(input.conditions !== undefined
        ? { conditions: input.conditions as Prisma.InputJsonValue }
        : {}),
      ...(input.fallbackQueueId !== undefined
        ? { fallbackQueueId: input.fallbackQueueId }
        : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.requiredSkillIds !== undefined
        ? { requiredSkillIds: input.requiredSkillIds ?? Prisma.JsonNull }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.targetQueueId !== undefined
        ? { targetQueueId: input.targetQueueId }
        : {}),
    },
    include: routingRuleInclude,
  });
}

export async function deleteInboxRoutingRule(companyId: string, ruleId: string) {
  const existing = await getInboxRoutingRule(companyId, ruleId);

  return prisma.inboxRoutingRule.delete({
    where: {
      id: existing.id,
    },
  });
}
