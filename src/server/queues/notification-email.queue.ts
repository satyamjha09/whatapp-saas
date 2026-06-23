import { Queue } from "bullmq";
import IORedis from "ioredis";

export const NOTIFICATION_EMAIL_QUEUE = "notification-email";

let notificationEmailConnection: IORedis | undefined;
let notificationEmailQueue: Queue | undefined;

export function getNotificationEmailConnection() {
  notificationEmailConnection ??= new IORedis(
    process.env.REDIS_URL ?? "redis://localhost:6379",
    {
      maxRetriesPerRequest: null,
    },
  );

  return notificationEmailConnection;
}

export function getNotificationEmailQueue() {
  notificationEmailQueue ??= new Queue(NOTIFICATION_EMAIL_QUEUE, {
    connection: getNotificationEmailConnection(),
  });

  return notificationEmailQueue;
}

export async function closeNotificationEmailQueue() {
  if (notificationEmailQueue) {
    await notificationEmailQueue.close();
    notificationEmailQueue = undefined;
  }

  if (notificationEmailConnection) {
    notificationEmailConnection.disconnect();
    notificationEmailConnection = undefined;
  }
}
