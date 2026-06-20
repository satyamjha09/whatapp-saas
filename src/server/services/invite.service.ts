import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { revalidateCompanyMembersCache } from "@/server/services/team.service";
import { CreateCompanyInviteInput } from "@/server/validators/invite.validator";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createInviteToken() {
  return crypto.randomBytes(32).toString("hex");
}

export async function getCompanyInvites(companyId: string) {
  return prisma.companyInvite.findMany({
    where: {
      companyId,
    },
    include: {
      invitedBy: true,
      acceptedBy: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function createCompanyInvite(
  companyId: string,
  invitedByUserId: string,
  input: CreateCompanyInviteInput,
) {
  const normalizedEmail = input.email.toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: {
      email: normalizedEmail,
    },
  });

  if (existingUser) {
    const existingMembership = await prisma.companyUser.findFirst({
      where: {
        companyId,
        userId: existingUser.id,
      },
    });

    if (existingMembership) {
      throw new Error("User is already a member of this company");
    }
  }

  const existingPendingInvite = await prisma.companyInvite.findFirst({
    where: {
      companyId,
      email: normalizedEmail,
      status: "PENDING",
      expiresAt: {
        gt: new Date(),
      },
    },
  });

  if (existingPendingInvite) {
    throw new Error("A pending invite already exists for this email");
  }

  const token = createInviteToken();
  const tokenHash = hashToken(token);

  const invite = await prisma.companyInvite.create({
    data: {
      companyId,
      email: normalizedEmail,
      role: input.role,
      tokenHash,
      invitedByUserId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    include: {
      invitedBy: true,
    },
  });

  return {
    invite,
    token,
  };
}

export async function getInviteByToken(token: string) {
  const tokenHash = hashToken(token);

  return prisma.companyInvite.findUnique({
    where: {
      tokenHash,
    },
    include: {
      company: true,
    },
  });
}

export async function acceptCompanyInvite(token: string, userId: string) {
  const tokenHash = hashToken(token);

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const invite = await prisma.companyInvite.findUnique({
    where: {
      tokenHash,
    },
    include: {
      company: true,
    },
  });

  if (!invite) {
    throw new Error("Invite not found");
  }

  if (invite.status !== "PENDING") {
    throw new Error("Invite is not pending");
  }

  if (invite.expiresAt < new Date()) {
    await prisma.companyInvite.update({
      where: {
        id: invite.id,
      },
      data: {
        status: "EXPIRED",
      },
    });

    throw new Error("Invite has expired");
  }

  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error("This invite belongs to another email address");
  }

  const existingMembership = await prisma.companyUser.findFirst({
    where: {
      companyId: invite.companyId,
      userId: user.id,
    },
  });

  if (existingMembership) {
    throw new Error("User is already a member of this company");
  }

  const result = await prisma.$transaction(async (tx) => {
    const membership = await tx.companyUser.create({
      data: {
        companyId: invite.companyId,
        userId: user.id,
        role: invite.role,
      },
      include: {
        company: true,
        user: true,
      },
    });

    const updatedInvite = await tx.companyInvite.update({
      where: {
        id: invite.id,
      },
      data: {
        status: "ACCEPTED",
        acceptedByUserId: user.id,
        acceptedAt: new Date(),
      },
    });

    return {
      membership,
      invite: updatedInvite,
    };
  });

  revalidateCompanyMembersCache();

  return result;
}

export async function revokeCompanyInvite(
  companyId: string,
  inviteId: string,
) {
  const invite = await prisma.companyInvite.findFirst({
    where: {
      id: inviteId,
      companyId,
    },
  });

  if (!invite) {
    throw new Error("Invite not found");
  }

  if (invite.status !== "PENDING") {
    throw new Error("Only pending invites can be revoked");
  }

  const revokedInvite = await prisma.companyInvite.update({
    where: {
      id: invite.id,
    },
    data: {
      status: "REVOKED",
    },
    include: {
      invitedBy: true,
      acceptedBy: true,
    },
  });

  return revokedInvite;
}
