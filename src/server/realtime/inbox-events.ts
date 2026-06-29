import { getRedisConnection } from "@/lib/redis";

export type InboxRealtimeEvent =
  | {
      type: "INBOUND_MESSAGE_CREATED";
      companyId: string;
      contactId: string;
      messageId: string;
      body: string;
      createdAt: string;
    }
  | {
      type: "MESSAGE_STATUS_UPDATED";
      companyId: string;
      messageId: string;
      status: string;
      createdAt: string;
    };

export function getInboxRealtimeChannel(companyId: string) {
  return `company:${companyId}:inbox`;
}

export async function publishInboxRealtimeEvent(event: InboxRealtimeEvent) {
  const redis = getRedisConnection();

  await redis.publish(getInboxRealtimeChannel(event.companyId), JSON.stringify(event));
}
