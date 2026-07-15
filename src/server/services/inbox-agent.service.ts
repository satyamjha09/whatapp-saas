import { prisma } from "@/lib/prisma";
import type {
  AssignInboxAgentSkillInput,
  UpsertInboxAgentProfileInput,
} from "@/server/validators/inbox-agent.validator";

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

export async function listInboxAgentProfiles(companyId: string) {
  const memberships = await prisma.companyUser.findMany({
    where: { companyId },
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
    orderBy: [{ createdAt: "asc" }],
  });

  const profiles = await prisma.inboxAgentProfile.findMany({
    where: { companyId },
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

  const skills = await prisma.inboxAgentSkill.findMany({
    where: { companyId },
    include: {
      skill: true,
    },
    orderBy: [{ level: "desc" }],
  });

  const openCounts = await prisma.contact.groupBy({
    by: ["assignedToUserId"],
    where: {
      companyId,
      inboxStatus: "OPEN",
      assignedToUserId: { not: null },
    },
    _count: {
      _all: true,
    },
  });

  const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));
  const skillsByUserId = new Map<string, typeof skills>();
  const openCountByUserId = new Map(
    openCounts
      .filter((row) => row.assignedToUserId)
      .map((row) => [row.assignedToUserId as string, row._count._all]),
  );

  for (const skill of skills) {
    const current = skillsByUserId.get(skill.userId) ?? [];
    current.push(skill);
    skillsByUserId.set(skill.userId, current);
  }

  return memberships.map((membership) => ({
    user: membership.user,
    membershipRole: membership.role,
    profile: profileByUserId.get(membership.userId) ?? null,
    skills: skillsByUserId.get(membership.userId) ?? [],
    openConversationCount: openCountByUserId.get(membership.userId) ?? 0,
  }));
}

export async function upsertInboxAgentProfile(
  companyId: string,
  input: UpsertInboxAgentProfileInput,
) {
  await assertCompanyMember(companyId, input.userId);

  return prisma.inboxAgentProfile.upsert({
    where: {
      companyId_userId: {
        companyId,
        userId: input.userId,
      },
    },
    create: {
      companyId,
      userId: input.userId,
      availabilityStatus: input.availabilityStatus,
      acceptingNew: input.acceptingNew,
      maxOpenConversations: input.maxOpenConversations,
      preferredLanguage: input.preferredLanguage,
      timezone: input.timezone,
    },
    update: {
      availabilityStatus: input.availabilityStatus,
      acceptingNew: input.acceptingNew,
      maxOpenConversations: input.maxOpenConversations,
      preferredLanguage: input.preferredLanguage,
      timezone: input.timezone,
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

export async function assignInboxAgentSkill(
  companyId: string,
  input: AssignInboxAgentSkillInput,
) {
  await assertCompanyMember(companyId, input.userId);

  const skill = await prisma.inboxSkill.findFirst({
    where: {
      id: input.skillId,
      companyId,
    },
  });

  if (!skill) {
    throw new Error("Skill not found");
  }

  return prisma.inboxAgentSkill.upsert({
    where: {
      userId_skillId: {
        userId: input.userId,
        skillId: input.skillId,
      },
    },
    create: {
      companyId,
      userId: input.userId,
      skillId: input.skillId,
      level: input.level,
    },
    update: {
      level: input.level,
    },
    include: {
      skill: true,
    },
  });
}

export async function removeInboxAgentSkill(
  companyId: string,
  userId: string,
  skillId: string,
) {
  const agentSkill = await prisma.inboxAgentSkill.findFirst({
    where: {
      companyId,
      userId,
      skillId,
    },
  });

  if (!agentSkill) {
    throw new Error("Agent skill not found");
  }

  return prisma.inboxAgentSkill.delete({
    where: {
      id: agentSkill.id,
    },
  });
}
