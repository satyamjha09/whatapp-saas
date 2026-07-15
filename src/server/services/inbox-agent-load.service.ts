import {
  InboxAgentAvailabilityStatus,
  InboxAssignmentMode,
  InboxQueueStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getRedisConnection } from "@/lib/redis";
import { getCompanyAgentPresence } from "@/server/realtime/inbox-presence";

export type EligibleInboxAgent = {
  userId: string;
  queueMemberId: string;
  openCount: number;
  capacity: number;
  lastAssignedAt: Date | null;
  presenceStatus: InboxAgentAvailabilityStatus | null;
};

const DEFAULT_AGENT_CAPACITY = 25;

export async function getOpenConversationCounts({
  companyId,
  userIds,
}: {
  companyId: string;
  userIds: string[];
}) {
  if (userIds.length === 0) return new Map<string, number>();

  const grouped = await prisma.contact.groupBy({
    by: ["assignedToUserId"],
    where: {
      companyId,
      assignedToUserId: {
        in: userIds,
      },
      inboxStatus: "OPEN",
    },
    _count: {
      _all: true,
    },
  });

  return new Map(
    grouped
      .filter((row) => row.assignedToUserId)
      .map((row) => [row.assignedToUserId!, row._count._all]),
  );
}

export async function getEligibleQueueAgents({
  companyId,
  queueId,
  requiredSkillIds = [],
}: {
  companyId: string;
  queueId: string;
  requiredSkillIds?: string[];
}): Promise<EligibleInboxAgent[]> {
  const queue = await prisma.inboxQueue.findFirst({
    where: {
      companyId,
      id: queueId,
      status: InboxQueueStatus.ACTIVE,
    },
    include: {
      members: {
        where: {
          acceptingNew: true,
          role: {
            in: ["AGENT", "SUPERVISOR"],
          },
        },
        include: {
          user: {
            select: {
              id: true,
            },
          },
        },
        orderBy: [
          {
            sortOrder: "asc",
          },
          {
            joinedAt: "asc",
          },
        ],
      },
    },
  });

  if (!queue) return [];

  const userIds = [...new Set(queue.members.map((member) => member.userId))];
  if (userIds.length === 0) return [];

  const [memberships, profiles, openCounts, agentSkills, presence] =
    await Promise.all([
      prisma.companyUser.findMany({
        where: {
          companyId,
          userId: {
            in: userIds,
          },
        },
        select: {
          userId: true,
        },
      }),
      prisma.inboxAgentProfile.findMany({
        where: {
          companyId,
          userId: {
            in: userIds,
          },
        },
      }),
      getOpenConversationCounts({ companyId, userIds }),
      requiredSkillIds.length
        ? prisma.inboxAgentSkill.findMany({
            where: {
              companyId,
              userId: {
                in: userIds,
              },
              skillId: {
                in: requiredSkillIds,
              },
            },
            select: {
              skillId: true,
              userId: true,
            },
          })
        : Promise.resolve([]),
      getCompanyAgentPresence(companyId).catch(() => []),
    ]);

  const memberUserIds = new Set(memberships.map((membership) => membership.userId));
  const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));
  const presenceByUserId = new Map(
    presence.map((item) => [item.userId, item.status]),
  );
  const skillsByUserId = new Map<string, Set<string>>();

  for (const skill of agentSkills) {
    const current = skillsByUserId.get(skill.userId) ?? new Set<string>();
    current.add(skill.skillId);
    skillsByUserId.set(skill.userId, current);
  }

  const candidates = queue.members
    .filter((member) => memberUserIds.has(member.userId))
    .filter((member) => {
      if (requiredSkillIds.length === 0) return true;
      const userSkills = skillsByUserId.get(member.userId);
      return requiredSkillIds.every((skillId) => userSkills?.has(skillId));
    })
    .map((member) => {
      const profile = profileByUserId.get(member.userId);
      const openCount = openCounts.get(member.userId) ?? 0;
      const capacity =
        member.maxOpenOverride ??
        queue.maxOpenPerAgent ??
        profile?.maxOpenConversations ??
        DEFAULT_AGENT_CAPACITY;

      return {
        capacity,
        lastAssignedAt: profile?.lastAssignedAt ?? null,
        openCount,
        presenceStatus: presenceByUserId.get(member.userId) ?? null,
        queueMemberId: member.id,
        userId: member.userId,
        acceptingNew: profile?.acceptingNew ?? true,
      };
    })
    .filter((candidate) => candidate.acceptingNew)
    .filter((candidate) => candidate.openCount < candidate.capacity)
    .map((candidate) => ({
      capacity: candidate.capacity,
      lastAssignedAt: candidate.lastAssignedAt,
      openCount: candidate.openCount,
      presenceStatus: candidate.presenceStatus,
      queueMemberId: candidate.queueMemberId,
      userId: candidate.userId,
    }));

  const onlineCandidates = candidates.filter(
    (candidate) => candidate.presenceStatus === InboxAgentAvailabilityStatus.AVAILABLE,
  );

  return onlineCandidates.length > 0 ? onlineCandidates : candidates;
}

export async function selectRoundRobinAgent({
  companyId,
  queueId,
  candidates,
}: {
  companyId: string;
  queueId: string;
  candidates: EligibleInboxAgent[];
}) {
  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => a.userId.localeCompare(b.userId));
  const redis = getRedisConnection();
  const cursor = await redis.incr(`inbox:round-robin:${companyId}:${queueId}`);

  return sorted[(cursor - 1) % sorted.length] ?? null;
}

export function selectLeastLoadedAgent(candidates: EligibleInboxAgent[]) {
  if (candidates.length === 0) return null;

  return [...candidates].sort((a, b) => {
    if (a.openCount !== b.openCount) return a.openCount - b.openCount;

    const aAssigned = a.lastAssignedAt?.getTime() ?? 0;
    const bAssigned = b.lastAssignedAt?.getTime() ?? 0;
    if (aAssigned !== bAssigned) return aAssigned - bAssigned;

    return a.userId.localeCompare(b.userId);
  })[0];
}

export async function selectAgentForQueue({
  assignmentMode,
  companyId,
  queueId,
  requiredSkillIds = [],
}: {
  assignmentMode: InboxAssignmentMode;
  companyId: string;
  queueId: string;
  requiredSkillIds?: string[];
}) {
  const candidates = await getEligibleQueueAgents({
    companyId,
    queueId,
    requiredSkillIds,
  });

  if (assignmentMode === InboxAssignmentMode.ROUND_ROBIN) {
    return selectRoundRobinAgent({ candidates, companyId, queueId });
  }

  if (
    assignmentMode === InboxAssignmentMode.LEAST_OPEN ||
    assignmentMode === InboxAssignmentMode.HYBRID
  ) {
    return selectLeastLoadedAgent(candidates);
  }

  return null;
}
