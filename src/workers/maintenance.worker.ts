import "dotenv/config";
import { Worker } from "bullmq";
import { getMaintenanceQueue } from "@/lib/queue";
import { getRedisConnection } from "@/lib/redis";
import { runSubscriptionExpiryJob } from "@/server/jobs/subscription-expiry.job";
import {
  runSubscriptionCancellationJob,
  SUBSCRIPTION_CANCELLATION_JOB,
} from "@/server/jobs/subscription-cancellation.job";
import { SUBSCRIPTION_EXPIRY_JOB } from "@/server/services/subscription-expiry.service";
import {
  DEVELOPER_DATA_RETENTION_JOB,
  runDeveloperDataRetentionJob,
} from "@/server/jobs/developer-data-retention.job";
import {
  COMPANY_NOTIFICATION_RETENTION_JOB,
  runCompanyNotificationRetentionJob,
} from "@/server/jobs/company-notification-retention.job";
import {
  COMPANY_NOTIFICATION_EMAIL_MAINTENANCE_JOB,
  runCompanyNotificationEmailMaintenanceJob,
} from "@/server/jobs/company-notification-email-maintenance.job";
import {
  OPERATIONS_HEALTH_ALERT_JOB,
  runOperationsHealthAlertJob,
} from "@/server/jobs/operations-health-alert.job";
import {
  DATABASE_BACKUP_JOB,
  runDatabaseBackupJob,
} from "@/server/jobs/database-backup.job";
import {
  PROVIDER_WEBHOOK_EVENT_RETENTION_JOB,
  runProviderWebhookEventRetentionJob,
} from "@/server/jobs/provider-webhook-event-retention.job";
import {
  DEAD_LETTER_QUEUE_SYNC_JOB,
  runDeadLetterQueueSyncJob,
} from "@/server/jobs/dead-letter-queue-sync.job";
import {
  BILLING_RECONCILIATION_JOB,
  runBillingReconciliationJob,
} from "@/server/jobs/billing-reconciliation.job";
import {
  PUBLIC_API_IDEMPOTENCY_RETENTION_JOB,
  runPublicApiIdempotencyRetentionJob,
} from "@/server/jobs/public-api-idempotency-retention.job";
import {
  CAMPAIGN_ANALYTICS_V2_JOB,
  runCampaignAnalyticsV2Job,
} from "@/server/jobs/campaign-analytics-v2.job";
import {
  UPTIME_MONITORING_JOB,
  UPTIME_MONITORING_RETENTION_JOB,
  runUptimeMonitoringJob,
  runUptimeMonitoringRetentionJob,
} from "@/server/jobs/uptime-monitoring.job";
import {
  STATUS_PAGE_SYNC_JOB,
  runStatusPageSyncJob,
} from "@/server/jobs/status-page-sync.job";
import {
  PRIVACY_EXPORT_CLEANUP_JOB,
  PRIVACY_REQUEST_RETENTION_JOB,
  runPrivacyExportCleanupJob,
  runPrivacyRequestRetentionJob,
} from "@/server/jobs/privacy-center.job";
import {
  DATA_RETENTION_JOB,
  runDataRetentionJob,
} from "@/server/jobs/data-retention.job";
import {
  COMPLIANCE_EVIDENCE_CLEANUP_JOB,
  runComplianceEvidenceCleanupJob,
} from "@/server/jobs/compliance-evidence.job";
import {
  runUsageQuotaAlertJob,
  USAGE_QUOTA_ALERT_JOB,
} from "@/server/jobs/usage-quota-alert.job";
import {
  runSubscriptionRenewalJob,
  SUBSCRIPTION_RENEWAL_JOB,
} from "@/server/jobs/subscription-renewal.job";
import {
  runScheduledPlanChangeJob,
  SCHEDULED_PLAN_CHANGE_JOB,
} from "@/server/jobs/scheduled-plan-change.job";
import {
  PLAN_CHECKOUT_RECONCILIATION_JOB,
  runPlanCheckoutReconciliationJob,
} from "@/server/jobs/plan-checkout-reconciliation.job";
import {
  BILLING_REFUND_RECONCILIATION_JOB,
  runBillingRefundReconciliationJob,
} from "@/server/jobs/billing-refund-reconciliation.job";
import {
  BILLING_ANALYTICS_JOB,
  runBillingAnalyticsJob,
} from "@/server/jobs/billing-analytics.job";
import {
  CAMPAIGN_THROUGHPUT_SNAPSHOT_JOB,
  runCampaignThroughputSnapshotJob,
} from "@/server/jobs/campaign-throughput-snapshot.job";
import {
  CAMPAIGN_COMPLETION_REPORT_JOB,
  runCampaignCompletionReportJob,
} from "@/server/jobs/campaign-completion-report.job";
import { createWorkerHeartbeat } from "@/server/services/worker-heartbeat.service";

const heartbeat = createWorkerHeartbeat({
  workerName: "maintenance-worker",
});

async function ensureRepeatableJobs() {
  await getMaintenanceQueue().add(
    SUBSCRIPTION_EXPIRY_JOB,
    {},
    {
      repeat: { every: 60 * 60 * 1000 },
      jobId: SUBSCRIPTION_EXPIRY_JOB,
      removeOnComplete: { age: 24 * 60 * 60, count: 100 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 200 },
    },
  );
  await getMaintenanceQueue().add(
    SUBSCRIPTION_CANCELLATION_JOB,
    {},
    {
      repeat: { every: 60 * 60 * 1000 },
      jobId: SUBSCRIPTION_CANCELLATION_JOB,
      removeOnComplete: { age: 24 * 60 * 60, count: 100 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 200 },
    },
  );
  await getMaintenanceQueue().add(
    DEVELOPER_DATA_RETENTION_JOB,
    {},
    {
      repeat: { every: 24 * 60 * 60 * 1000 },
      jobId: DEVELOPER_DATA_RETENTION_JOB,
      removeOnComplete: { age: 24 * 60 * 60, count: 100 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 200 },
    },
  );
  await getMaintenanceQueue().add(
    COMPANY_NOTIFICATION_RETENTION_JOB,
    {},
    {
      repeat: { every: 24 * 60 * 60 * 1000 },
      jobId: COMPANY_NOTIFICATION_RETENTION_JOB,
      removeOnComplete: { age: 24 * 60 * 60, count: 100 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 200 },
    },
  );
  await getMaintenanceQueue().add(
    COMPANY_NOTIFICATION_EMAIL_MAINTENANCE_JOB,
    {},
    {
      repeat: { every: 60 * 60 * 1000 },
      jobId: COMPANY_NOTIFICATION_EMAIL_MAINTENANCE_JOB,
      removeOnComplete: { age: 24 * 60 * 60, count: 100 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 200 },
    },
  );
  await getMaintenanceQueue().add(
    OPERATIONS_HEALTH_ALERT_JOB,
    {},
    {
      repeat: { every: 30 * 60 * 1000 },
      jobId: OPERATIONS_HEALTH_ALERT_JOB,
      removeOnComplete: { age: 24 * 60 * 60, count: 100 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 200 },
    },
  );
  await getMaintenanceQueue().add(
    DATABASE_BACKUP_JOB,
    {},
    {
      repeat: { every: 24 * 60 * 60 * 1000 },
      jobId: DATABASE_BACKUP_JOB,
      removeOnComplete: { age: 24 * 60 * 60, count: 100 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 200 },
    },
  );
  await getMaintenanceQueue().add(
    PROVIDER_WEBHOOK_EVENT_RETENTION_JOB,
    {},
    {
      repeat: {
        pattern: "45 3 * * *",
      },
      jobId: PROVIDER_WEBHOOK_EVENT_RETENTION_JOB,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  await getMaintenanceQueue().add(
    DEAD_LETTER_QUEUE_SYNC_JOB,
    {},
    {
      repeat: { pattern: "*/10 * * * *" },
      jobId: DEAD_LETTER_QUEUE_SYNC_JOB,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  await getMaintenanceQueue().add(
    BILLING_RECONCILIATION_JOB,
    {},
    {
      repeat: { pattern: "15 4 * * *" },
      jobId: BILLING_RECONCILIATION_JOB,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  await getMaintenanceQueue().add(
    PUBLIC_API_IDEMPOTENCY_RETENTION_JOB,
    {},
    {
      repeat: { pattern: "25 3 * * *" },
      jobId: PUBLIC_API_IDEMPOTENCY_RETENTION_JOB,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  await getMaintenanceQueue().add(
    CAMPAIGN_ANALYTICS_V2_JOB,
    {},
    {
      repeat: { pattern: "*/15 * * * *" },
      jobId: CAMPAIGN_ANALYTICS_V2_JOB,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  await getMaintenanceQueue().add(
    UPTIME_MONITORING_JOB,
    {},
    {
      repeat: { pattern: "* * * * *" },
      jobId: UPTIME_MONITORING_JOB,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  await getMaintenanceQueue().add(
    UPTIME_MONITORING_RETENTION_JOB,
    {},
    {
      repeat: { pattern: "40 3 * * *" },
      jobId: UPTIME_MONITORING_RETENTION_JOB,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  await getMaintenanceQueue().add(
    STATUS_PAGE_SYNC_JOB,
    {},
    {
      repeat: { pattern: "*/5 * * * *" },
      jobId: STATUS_PAGE_SYNC_JOB,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  await getMaintenanceQueue().add(
    PRIVACY_EXPORT_CLEANUP_JOB,
    {},
    {
      repeat: { pattern: "20 3 * * *" },
      jobId: PRIVACY_EXPORT_CLEANUP_JOB,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  await getMaintenanceQueue().add(
    PRIVACY_REQUEST_RETENTION_JOB,
    {},
    {
      repeat: { pattern: "50 3 * * *" },
      jobId: PRIVACY_REQUEST_RETENTION_JOB,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  await getMaintenanceQueue().add(
    DATA_RETENTION_JOB,
    {},
    {
      repeat: { pattern: "10 4 * * *" },
      jobId: DATA_RETENTION_JOB,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  await getMaintenanceQueue().add(
    COMPLIANCE_EVIDENCE_CLEANUP_JOB,
    {},
    {
      repeat: { pattern: "35 3 * * *" },
      jobId: COMPLIANCE_EVIDENCE_CLEANUP_JOB,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  await getMaintenanceQueue().add(
    USAGE_QUOTA_ALERT_JOB,
    {},
    {
      repeat: {
        pattern: process.env.USAGE_QUOTA_ALERTS_SCAN_CRON || "25 5 * * *",
      },
      jobId: USAGE_QUOTA_ALERT_JOB,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  await getMaintenanceQueue().add(
    SUBSCRIPTION_RENEWAL_JOB,
    {},
    {
      repeat: {
        pattern: process.env.SUBSCRIPTION_RENEWAL_SCAN_CRON || "15 6 * * *",
      },
      jobId: SUBSCRIPTION_RENEWAL_JOB,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  await getMaintenanceQueue().add(
    SCHEDULED_PLAN_CHANGE_JOB,
    {},
    {
      repeat: {
        pattern: process.env.PLAN_CHANGE_SCHEDULER_CRON || "35 6 * * *",
      },
      jobId: SCHEDULED_PLAN_CHANGE_JOB,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  await getMaintenanceQueue().add(
    PLAN_CHECKOUT_RECONCILIATION_JOB,
    {},
    {
      repeat: {
        pattern:
          process.env.PLAN_CHECKOUT_RECONCILIATION_SCAN_CRON || "*/20 * * * *",
      },
      jobId: PLAN_CHECKOUT_RECONCILIATION_JOB,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  await getMaintenanceQueue().add(
    BILLING_REFUND_RECONCILIATION_JOB,
    {},
    {
      repeat: {
        pattern: process.env.BILLING_REFUND_RECONCILIATION_SCAN_CRON || "*/30 * * * *",
      },
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  await getMaintenanceQueue().add(
    BILLING_ANALYTICS_JOB,
    {},
    {
      repeat: {
        pattern: process.env.BILLING_ANALYTICS_SNAPSHOT_CRON || "45 6 * * *",
      },
      jobId: BILLING_ANALYTICS_JOB,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  await getMaintenanceQueue().add(
    CAMPAIGN_THROUGHPUT_SNAPSHOT_JOB,
    {},
    {
      repeat: {
        pattern: "*/15 * * * *",
      },
      jobId: CAMPAIGN_THROUGHPUT_SNAPSHOT_JOB,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
  await getMaintenanceQueue().add(
    CAMPAIGN_COMPLETION_REPORT_JOB,
    {},
    {
      repeat: {
        pattern: "*/10 * * * *",
      },
      jobId: CAMPAIGN_COMPLETION_REPORT_JOB,
      removeOnComplete: 50,
      removeOnFail: 100,
    },
  );
}

const worker = new Worker(
  "maintenance-queue",
  async (job) => {
    if (job.name === SUBSCRIPTION_EXPIRY_JOB) {
      const result = await runSubscriptionExpiryJob();
      console.log("Subscription expiry check completed", result);
      return result;
    }

    if (job.name === SUBSCRIPTION_CANCELLATION_JOB) {
      const result = await runSubscriptionCancellationJob();
      console.log("Subscription cancellation check completed", result);
      return result;
    }

    if (job.name === DEVELOPER_DATA_RETENTION_JOB) {
      const result = await runDeveloperDataRetentionJob();
      console.log("Developer data retention cleanup completed", result);
      return result;
    }

    if (job.name === COMPANY_NOTIFICATION_RETENTION_JOB) {
      const result = await runCompanyNotificationRetentionJob();
      console.log("Company notification retention cleanup completed", result);
      return result;
    }

    if (job.name === COMPANY_NOTIFICATION_EMAIL_MAINTENANCE_JOB) {
      const result = await runCompanyNotificationEmailMaintenanceJob();
      console.log("Notification email maintenance completed", result);
      return result;
    }

    if (job.name === OPERATIONS_HEALTH_ALERT_JOB) {
      const result = await runOperationsHealthAlertJob();
      console.log("Operations health alert check completed", result);
      return result;
    }

    if (job.name === DATABASE_BACKUP_JOB) {
      const result = await runDatabaseBackupJob();
      console.log("Database backup job completed", result);
      return result;
    }

    if (job.name === PROVIDER_WEBHOOK_EVENT_RETENTION_JOB) {
      const result = await runProviderWebhookEventRetentionJob();
      console.log("Provider webhook event retention completed", result);
      return result;
    }

    if (job.name === DEAD_LETTER_QUEUE_SYNC_JOB) {
      const result = await runDeadLetterQueueSyncJob();
      console.log("Dead letter queue sync completed", result);
      return result;
    }

    if (job.name === BILLING_RECONCILIATION_JOB) {
      const result = await runBillingReconciliationJob();
      console.log("Billing reconciliation completed", result);
      return result;
    }

    if (job.name === PUBLIC_API_IDEMPOTENCY_RETENTION_JOB) {
      const result = await runPublicApiIdempotencyRetentionJob();
      console.log("Public API idempotency retention completed", result);
      return result;
    }

    if (job.name === CAMPAIGN_ANALYTICS_V2_JOB) {
      const result = await runCampaignAnalyticsV2Job();
      console.log("Campaign analytics v2 sync completed", result);
      return result;
    }

    if (job.name === UPTIME_MONITORING_JOB) {
      const result = await runUptimeMonitoringJob();
      console.log("Uptime monitoring job completed", result);
      return result;
    }

    if (job.name === UPTIME_MONITORING_RETENTION_JOB) {
      const result = await runUptimeMonitoringRetentionJob();
      console.log("Uptime monitoring retention completed", result);
      return result;
    }

    if (job.name === STATUS_PAGE_SYNC_JOB) {
      const result = await runStatusPageSyncJob();
      console.log("Status page sync completed", result);
      return result;
    }

    if (job.name === PRIVACY_EXPORT_CLEANUP_JOB) {
      const result = await runPrivacyExportCleanupJob();
      console.log("Privacy export cleanup completed", result);
      return result;
    }

    if (job.name === PRIVACY_REQUEST_RETENTION_JOB) {
      const result = await runPrivacyRequestRetentionJob();
      console.log("Privacy request retention cleanup completed", result);
      return result;
    }

    if (job.name === DATA_RETENTION_JOB) {
      const result = await runDataRetentionJob();
      console.log("Data retention completed", result);
      return result;
    }

    if (job.name === COMPLIANCE_EVIDENCE_CLEANUP_JOB) {
      const result = await runComplianceEvidenceCleanupJob();
      console.log("Compliance evidence cleanup completed", result);
      return result;
    }

    if (job.name === USAGE_QUOTA_ALERT_JOB) {
      const result = await runUsageQuotaAlertJob();
      console.log("Usage quota alert scan completed", result);
      return result;
    }

    if (job.name === SUBSCRIPTION_RENEWAL_JOB) {
      const result = await runSubscriptionRenewalJob();
      console.log("Subscription renewal scan completed", result);
      return result;
    }

    if (job.name === SCHEDULED_PLAN_CHANGE_JOB) {
      const result = await runScheduledPlanChangeJob();
      console.log("Scheduled plan change scan completed", result);
      return result;
    }

    if (job.name === PLAN_CHECKOUT_RECONCILIATION_JOB) {
      const result = await runPlanCheckoutReconciliationJob();
      console.log("Plan checkout reconciliation scan completed", result);
      return result;
    }

    if (job.name === BILLING_REFUND_RECONCILIATION_JOB) {
      const result = await runBillingRefundReconciliationJob();
      console.log("Billing refund reconciliation scan completed", result);
      return result;
    }

    if (job.name === BILLING_ANALYTICS_JOB) {
      const result = await runBillingAnalyticsJob();
      console.log("Billing analytics snapshot completed", result);
      return result;
    }

    if (job.name === CAMPAIGN_THROUGHPUT_SNAPSHOT_JOB) {
      const result = await runCampaignThroughputSnapshotJob();
      console.log("Campaign throughput snapshot completed", result);
      return result;
    }

    if (job.name === CAMPAIGN_COMPLETION_REPORT_JOB) {
      const result = await runCampaignCompletionReportJob();
      console.log("Campaign completion report job completed", result);
      return result;
    }

    throw new Error(`Unknown maintenance job: ${job.name}`);
  },
  { connection: getRedisConnection() },
);

void heartbeat.start();

worker.on("failed", async (job, error) => {
  console.error(`[maintenance-worker] ${job?.name ?? "job"} failed:`, error);
  await heartbeat.markError(error);
});

void ensureRepeatableJobs()
  .then(() => {
    console.log("[maintenance-worker] Started.");
  })
  .catch((error) => {
    console.error("[maintenance-worker] Unable to schedule jobs:", error);
  });

async function shutdown() {
  console.log("[maintenance-worker] Shutting down.");
  await worker.close();
  await getMaintenanceQueue().close();
  await heartbeat.stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
