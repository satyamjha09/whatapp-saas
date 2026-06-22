import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getBillingPlanConfig } from "@/server/config/billing-plans";

type PlanLimitClient = typeof prisma | Prisma.TransactionClient;

async function getTeamMemberPlanUsageWithClient(
  companyId: string,
  client: PlanLimitClient,
) {
  const company = await client.company.findUnique({
    where: { id: companyId },
    select: { billingPlan: true },
  });

  if (!company) throw new Error("Company not found");

  const plan = getBillingPlanConfig(company.billingPlan);
  const [activeMembers, pendingInvites] = await Promise.all([
    client.companyUser.count({ where: { companyId } }),
    client.companyInvite.count({
      where: {
        companyId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
    }),
  ]);
  const usedSeats = activeMembers + pendingInvites;
  const remainingSeats = Math.max(plan.maxTeamMembers - usedSeats, 0);

  return {
    planId: plan.id,
    planName: plan.name,
    maxTeamMembers: plan.maxTeamMembers,
    activeMembers,
    pendingInvites,
    usedSeats,
    remainingSeats,
    canInvite: remainingSeats > 0,
  };
}

export function getTeamMemberPlanUsage(companyId: string) {
  return getTeamMemberPlanUsageWithClient(companyId, prisma);
}

export async function lockCompanyForTeamSeatCheck(
  tx: Prisma.TransactionClient,
  companyId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Company" WHERE "id" = ${companyId} FOR UPDATE
  `;

  if (rows.length === 0) throw new Error("Company not found");
}

export async function assertTeamMemberLimitForInvite(
  companyId: string,
  client: PlanLimitClient = prisma,
) {
  const usage = await getTeamMemberPlanUsageWithClient(companyId, client);

  if (!usage.canInvite) {
    throw new Error(
      `Your ${usage.planName} plan allows maximum ${usage.maxTeamMembers} team member(s)`,
    );
  }

  return usage;
}

export async function assertTeamMemberLimitForAcceptInvite(
  companyId: string,
  client: PlanLimitClient = prisma,
) {
  const company = await client.company.findUnique({
    where: { id: companyId },
    select: { billingPlan: true },
  });

  if (!company) throw new Error("Company not found");

  const plan = getBillingPlanConfig(company.billingPlan);
  const activeMembers = await client.companyUser.count({ where: { companyId } });

  if (activeMembers >= plan.maxTeamMembers) {
    throw new Error(
      `Your ${plan.name} plan allows maximum ${plan.maxTeamMembers} team member(s)`,
    );
  }

  return {
    planId: plan.id,
    planName: plan.name,
    maxTeamMembers: plan.maxTeamMembers,
    activeMembers,
    remainingSeats: Math.max(plan.maxTeamMembers - activeMembers, 0),
  };
}
