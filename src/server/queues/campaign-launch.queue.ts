import { Queue } from "bullmq";
import { getRedisConnection } from "@/lib/redis";

export type CampaignLaunchQueueJob = {
  companyId: string;
  launchRunId: string;
  campaignId: string;
};

function queueName() {
  return process.env.CAMPAIGN_LAUNCH_QUEUE_NAME || "campaign-launch";
}

let campaignLaunchQueue: Queue<CampaignLaunchQueueJob> | undefined;

export function getCampaignLaunchQueue() {
  campaignLaunchQueue ??= new Queue<CampaignLaunchQueueJob>(queueName(), {
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
        count: 1000,
      },
    },
  });

  return campaignLaunchQueue;
}

export function getCampaignLaunchQueueName() {
  return queueName();
}
