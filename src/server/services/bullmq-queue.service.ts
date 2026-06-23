import { Queue } from "bullmq";
import { getRedisConnection } from "@/lib/redis";

export function getBullQueue(queueName: string) {
  return new Queue(queueName, {
    connection: getRedisConnection(),
  });
}
