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
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  });

  return campaignLaunchQueue;
}

export function getCampaignLaunchQueueName() {
  return queueName();
}
