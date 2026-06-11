import { prisma } from "@/lib/prisma";
import {
  CreateQuickReplyInput,
  UpdateQuickReplyInput,
} from "@/server/validators/quick-reply.validator";

const quickReplyInclude = {
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
};

export async function getQuickRepliesByCompany(companyId: string) {
  return prisma.quickReply.findMany({
    where: {
      companyId,
    },
    include: quickReplyInclude,
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function createQuickReply(
  companyId: string,
  createdByUserId: string,
  input: CreateQuickReplyInput,
) {
  const existing = await prisma.quickReply.findUnique({
    where: {
      companyId_title: {
        companyId,
        title: input.title,
      },
    },
  });

  if (existing) {
    throw new Error("Quick reply with this title already exists");
  }

  return prisma.quickReply.create({
    data: {
      companyId,
      createdByUserId,
      title: input.title,
      body: input.body,
    },
    include: quickReplyInclude,
  });
}

export async function updateQuickReply(
  companyId: string,
  quickReplyId: string,
  input: UpdateQuickReplyInput,
) {
  const quickReply = await prisma.quickReply.findFirst({
    where: {
      id: quickReplyId,
      companyId,
    },
  });

  if (!quickReply) {
    throw new Error("Quick reply not found");
  }

  const duplicateTitle = await prisma.quickReply.findUnique({
    where: {
      companyId_title: {
        companyId,
        title: input.title,
      },
    },
  });

  if (duplicateTitle && duplicateTitle.id !== quickReply.id) {
    throw new Error("Quick reply with this title already exists");
  }

  return prisma.quickReply.update({
    where: {
      id: quickReply.id,
    },
    data: {
      title: input.title,
      body: input.body,
    },
    include: quickReplyInclude,
  });
}

export async function deleteQuickReply(
  companyId: string,
  quickReplyId: string,
) {
  const quickReply = await prisma.quickReply.findFirst({
    where: {
      id: quickReplyId,
      companyId,
    },
  });

  if (!quickReply) {
    throw new Error("Quick reply not found");
  }

  await prisma.quickReply.delete({
    where: {
      id: quickReply.id,
    },
  });

  return quickReply;
}
