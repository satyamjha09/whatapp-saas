import { prisma } from "@/lib/prisma";
import { getBillingPlanConfig } from "@/server/config/billing-plans";

export async function cleanupDeveloperDataRetention({
  companyId,
}: {
  companyId: string;
}) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, billingPlan: true },
  });
  if (!company) throw new Error("Company not found");

  const retentionDays =
    getBillingPlanConfig(company.billingPlan).developerLogRetentionDays;
  const cutoff = new Date(
    Date.now() - retentionDays * 24 * 60 * 60 * 1_000,
  );

  const [
    apiRequestLogs,
    webhookDeliveries,
    deliveredOutboxEvents,
    failedOutboxEvents,
  ] = await prisma.$transaction([
    prisma.developerApiRequestLog.deleteMany({
      where: { companyId, createdAt: { lt: cutoff } },
    }),
    prisma.developerWebhookDelivery.deleteMany({
      where: { companyId, createdAt: { lt: cutoff } },
    }),
    prisma.developerWebhookOutbox.deleteMany({
      where: { companyId, status: "DELIVERED", createdAt: { lt: cutoff } },
    }),
    prisma.developerWebhookOutbox.deleteMany({
      where: { companyId, status: "FAILED", createdAt: { lt: cutoff } },
    }),
  ]);

  return {
    companyId,
    retentionDays,
    cutoff,
    deleted: {
      apiRequestLogs: apiRequestLogs.count,
      webhookDeliveryLogs: webhookDeliveries.count,
      deliveredOutboxEvents: deliveredOutboxEvents.count,
      failedOutboxEvents: failedOutboxEvents.count,
    },
  };
}

export async function cleanupDeveloperDataRetentionForAllCompanies({
  limit = 200,
}: {
  limit?: number;
} = {}) {
  const companies = await prisma.company.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const results = [];

  for (const company of companies) {
    results.push(
      await cleanupDeveloperDataRetention({ companyId: company.id }),
    );
  }

  return {
    checkedCount: companies.length,
    recoveredCount: results.reduce(
      (total, result) =>
        total +
        result.deleted.apiRequestLogs +
        result.deleted.webhookDeliveryLogs +
        result.deleted.deliveredOutboxEvents +
        result.deleted.failedOutboxEvents,
      0,
    ),
    results,
  };
}
