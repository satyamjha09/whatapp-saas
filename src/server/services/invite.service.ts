import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendTeamInviteTransactionalEmail } from "@/server/email/transactional-email";
import { buildTeamInviteEmail } from "@/server/email/templates/team-invite-email";
import { revalidateCompanyMembersCache } from "@/server/services/team.service";
import { backfillCompanyNotificationRecipients } from "@/server/services/company-notification.service";
import { ensureCompanyNotificationPreferences } from "@/server/services/company-notification-preference.service";
import {
  assertTeamMemberLimitForAcceptInvite,
  assertTeamMemberLimitForInvite,
  lockCompanyForTeamSeatCheck,
} from "@/server/services/plan-limit.service";
import {
  assertUsageQuotaAvailable,
  incrementUsageQuota,
} from "@/server/services/usage-quota.service";
import { CreateCompanyInviteInput } from "@/server/validators/invite.validator";
import { seedCompanySystemRoles } from "@/server/services/rbac-v2.service";

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

  const invite = await prisma.$transaction(async (tx) => {
    await lockCompanyForTeamSeatCheck(tx, companyId);
    await assertTeamMemberLimitForInvite(companyId, tx);

    return tx.companyInvite.create({
      data: {
        companyId,
        email: normalizedEmail,
        role: input.role,
        tokenHash,
        invitedByUserId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      include: {
        company: {
          select: {
            name: true,
          },
        },
        invitedBy: true,
      },
    });
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const inviteUrl = `${appUrl}/invite/${token}`;
  let emailResult:
    | {
        skipped?: boolean;
        reason?: string;
        messageId?: string;
      }
    | undefined;

  try {
    const email = buildTeamInviteEmail({
      companyName: invite.company.name,
      invitedByName: invite.invitedBy.name,
      invitedByEmail: invite.invitedBy.email,
      role: invite.role,
      inviteUrl,
      expiresAt: invite.expiresAt,
    });

    emailResult = await sendTeamInviteTransactionalEmail({
      to: normalizedEmail,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  } catch (error) {
    emailResult = {
      skipped: true,
      reason: error instanceof Error ? error.message : "Email failed.",
    };
  }

  return {
    invite,
    token,
    inviteUrl,
    emailResult,
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

  if (
    invite.company.status !== "ACTIVE" &&
    invite.company.status !== "PENDING_ONBOARDING"
  ) {
    throw new Error("This company workspace is not active");
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

  await seedCompanySystemRoles({ companyId: invite.companyId });
  await assertUsageQuotaAvailable({
    companyId: invite.companyId,
    featureKey: "TEAM",
    amount: 1,
  });

  const accessRoleSlug =
    invite.role === "OWNER"
      ? "owner"
      : invite.role === "ADMIN"
        ? "admin"
        : process.env.RBAC_V2_DEFAULT_MEMBER_ROLE || "member";
  const accessRole = await prisma.companyAccessRole.findUnique({
    where: {
      companyId_slug: {
        companyId: invite.companyId,
        slug: accessRoleSlug,
      },
    },
  });

  if (!accessRole) {
    throw new Error("Default access role not found");
  }

  const result = await prisma.$transaction(async (tx) => {
    await lockCompanyForTeamSeatCheck(tx, invite.companyId);
    await assertTeamMemberLimitForAcceptInvite(invite.companyId, tx);

    const currentMembership = await tx.companyUser.findFirst({
      where: { companyId: invite.companyId, userId: user.id },
    });
    if (currentMembership) {
      throw new Error("User is already a member of this company");
    }

    const currentInvite = await tx.companyInvite.findUnique({
      where: { id: invite.id },
      select: { status: true, expiresAt: true },
    });
    if (!currentInvite || currentInvite.status !== "PENDING") {
      throw new Error("Invite is not pending");
    }
    if (currentInvite.expiresAt < new Date()) {
      throw new Error("Invite has expired");
    }

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

    await tx.companyAccessRoleAssignment.upsert({
      where: {
        companyId_userId: {
          companyId: invite.companyId,
          userId: user.id,
        },
      },
      create: {
        companyId: invite.companyId,
        userId: user.id,
        roleId: accessRole.id,
      },
      update: {
        roleId: accessRole.id,
        assignedAt: new Date(),
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

    await tx.userWorkspacePreference.upsert({
      where: {
        userId: user.id,
      },
      create: {
        userId: user.id,
        activeCompanyId: invite.companyId,
        lastSelectedAt: new Date(),
      },
      update: {
        activeCompanyId: invite.companyId,
        lastSelectedAt: new Date(),
      },
    });

    return {
      membership,
      invite: updatedInvite,
    };
  });

  revalidateCompanyMembersCache();
  await ensureCompanyNotificationPreferences({
    companyId: invite.companyId,
    userId: result.membership.userId,
  });
  await backfillCompanyNotificationRecipients(invite.companyId);
  await incrementUsageQuota({
    companyId: invite.companyId,
    featureKey: "TEAM",
    amount: 1,
    idempotencyKey: `team-member-created:${result.membership.id}`,
    reason: "team-member-created",
    metadata: {
      companyUserId: result.membership.id,
      userId: result.membership.userId,
    },
  });

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
