import { prisma } from "@/lib/prisma";
import { getBillingSummary } from "@/server/services/wallet.service";
import { getRecentMaintenanceJobRuns } from "@/server/services/maintenance-job.service";
import { SUBSCRIPTION_EXPIRY_JOB } from "@/server/services/subscription-expiry.service";
import { SUBSCRIPTION_CANCELLATION_JOB } from "@/server/jobs/subscription-cancellation.job";
import { DEVELOPER_DATA_RETENTION_JOB } from "@/server/jobs/developer-data-retention.job";
import { COMPANY_NOTIFICATION_RETENTION_JOB } from "@/server/jobs/company-notification-retention.job";
import { COMPANY_NOTIFICATION_EMAIL_MAINTENANCE_JOB } from "@/server/jobs/company-notification-email-maintenance.job";

export async function getCreditCenterOverview(companyId: string) {
  const [billingSummary, creditPurchases, subscriptionPayments, razorpayWebhookEvents, recentSubscriptionExpiryRuns, recentSubscriptionCancellationRuns, recentDeveloperDataRetentionRuns, recentCompanyNotificationRetentionRuns, recentCompanyNotificationEmailMaintenanceRuns] =
    await Promise.all([
      getBillingSummary(companyId),
      prisma.creditPurchase.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.subscriptionPayment.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.razorpayWebhookEvent.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      getRecentMaintenanceJobRuns(SUBSCRIPTION_EXPIRY_JOB, companyId),
      getRecentMaintenanceJobRuns(SUBSCRIPTION_CANCELLATION_JOB, companyId),
      getRecentMaintenanceJobRuns(DEVELOPER_DATA_RETENTION_JOB, companyId),
      getRecentMaintenanceJobRuns(
        COMPANY_NOTIFICATION_RETENTION_JOB,
        companyId,
      ),
      getRecentMaintenanceJobRuns(
        COMPANY_NOTIFICATION_EMAIL_MAINTENANCE_JOB,
        companyId,
      ),
    ]);

  return {
    ...billingSummary,
    creditPurchases,
    subscriptionPayments,
    razorpayWebhookEvents,
    recentSubscriptionExpiryRuns,
    recentSubscriptionCancellationRuns,
    recentDeveloperDataRetentionRuns,
    recentCompanyNotificationRetentionRuns,
    recentCompanyNotificationEmailMaintenanceRuns,
  };
}
