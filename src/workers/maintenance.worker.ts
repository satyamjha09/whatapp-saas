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
