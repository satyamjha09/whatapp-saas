import { Queue } from "bullmq";
import { redisConnection } from "@/lib/redis";

export const messageQueue = new Queue("message-queue", {
  connection: redisConnection,
});

export type SendMessageJobData = {
  messageId: string;
  companyId: string;
};
