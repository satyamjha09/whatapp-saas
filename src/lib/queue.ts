import { Queue } from "bullmq";
import { getRedisConnection } from "@/lib/redis";

export const DEFAULT_MESSAGE_JOB_ATTEMPTS = 10;

let messageQueue: Queue | undefined;
let webhookQueue: Queue | undefined;
let developerWebhookQueue: Queue | undefined;
let maintenanceQueue: Queue | undefined;
let leadScoreQueue: Queue | undefined;
let automationRuntimeQueue: Queue | undefined;
let automationMonitoringQueue: Queue | undefined;
let contactImportQueue: Queue | undefined;

export function getContactImportQueue() {
  contactImportQueue ??= new Queue("contact-import-queue", {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 30_000,
      },
      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
        count: 1000,
      },
    },
  });

  return contactImportQueue;
}

export type ContactImportQueueJobData = {
  companyId: string;
  importId: string;
};

export function getMessageQueue() {
  messageQueue ??= new Queue("message-queue", {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: DEFAULT_MESSAGE_JOB_ATTEMPTS,
      backoff: {
        type: "exponential",
        delay: 60_000,
      },
      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
        count: 1000,
      },
    },
  });

  return messageQueue;
}

export function getWebhookQueue() {
  webhookQueue ??= new Queue("webhook-queue", {
    connection: getRedisConnection(),
  });

  return webhookQueue;
}

export function getDeveloperWebhookQueue() {
  developerWebhookQueue ??= new Queue("developer-webhook-queue", {
    connection: getRedisConnection(),
  });

  return developerWebhookQueue;
}

export function getMaintenanceQueue() {
  maintenanceQueue ??= new Queue("maintenance-queue", {
    connection: getRedisConnection(),
  });

  return maintenanceQueue;
}

export function getLeadScoreQueue() {
  leadScoreQueue ??= new Queue("lead-score-queue", {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 30_000,
      },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  });

  return leadScoreQueue;
}

export function getAutomationRuntimeQueue() {
  automationRuntimeQueue ??= new Queue("automation-runtime-queue", {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 30_000,
      },
      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
        count: 5000,
      },
    },
  });

  return automationRuntimeQueue;
}

export function getAutomationMonitoringQueue() {
  automationMonitoringQueue ??= new Queue("automation-monitoring-queue", {
    connection: getRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 30_000,
      },
      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 200,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
        count: 500,
      },
    },
  });

  return automationMonitoringQueue;
}

export type SendMessageJobData = {
  messageId: string;
  companyId: string;
};

export type ProcessWebhookJobData = {
  webhookEventId: string;
};

export type DeliverDeveloperWebhookJobData = {
  deliveryId: string;
};

export type LeadScoreJobData = {
  companyId: string;
  contactId: string;
};

export type AutomationRuntimeJobData = {
  companyId: string;
  contactId: string;
  inboundMessageId: string;
};
