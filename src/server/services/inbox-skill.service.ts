import { prisma } from "@/lib/prisma";
import type {
  CreateInboxSkillInput,
  UpdateInboxSkillInput,
} from "@/server/validators/inbox-skill.validator";

export function toInboxSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function listInboxSkills(companyId: string) {
  return prisma.inboxSkill.findMany({
    where: { companyId },
    include: {
      _count: {
        select: {
          agentSkills: true,
          requiredByQueues: true,
        },
      },
    },
    orderBy: [{ name: "asc" }],
  });
}

export async function createInboxSkill(
  companyId: string,
  input: CreateInboxSkillInput,
) {
  const slug = input.slug ?? toInboxSlug(input.name);

  if (!slug) {
    throw new Error("Skill slug is required");
  }

  return prisma.inboxSkill.create({
    data: {
      companyId,
      name: input.name,
      slug,
      description: input.description,
    },
  });
}

export async function updateInboxSkill(
  companyId: string,
  skillId: string,
  input: UpdateInboxSkillInput,
) {
  const skill = await prisma.inboxSkill.findFirst({
    where: { id: skillId, companyId },
  });

  if (!skill) {
    throw new Error("Skill not found");
  }

  return prisma.inboxSkill.update({
    where: { id: skill.id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
  });
}

export async function deleteInboxSkill(companyId: string, skillId: string) {
  const skill = await prisma.inboxSkill.findFirst({
    where: { id: skillId, companyId },
  });

  if (!skill) {
    throw new Error("Skill not found");
  }

  return prisma.inboxSkill.delete({
    where: { id: skill.id },
  });
}
