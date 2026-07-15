import { InboxAgentAvailabilityStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getRedisConnection } from "@/lib/redis";

const PRESENCE_TTL_SECONDS = 60;
const VIEWER_TTL_SECONDS = 45;
const TYPING_TTL_SECONDS = 8;

export type InboxPresenceRecord = {
  userId: string;
  status: InboxAgentAvailabilityStatus;
  lastSeenAt: string;
  activeContactId: string | null;
};

export type InboxPresenceUser = InboxPresenceRecord & {
  name: string | null;
  email: string;
};

export type InboxConversationPresenceUser = {
  userId: string;
  name: string | null;
  email: string;
  lastSeenAt: string;
};

function presenceKey(companyId: string, userId: string) {
  return `inbox:presence:${companyId}:${userId}`;
}

function viewerKey(companyId: string, contactId: string, userId: string) {
  return `inbox:viewer:${companyId}:${contactId}:${userId}`;
}

function typingKey(companyId: string, contactId: string, userId: string) {
  return `inbox:typing:${companyId}:${contactId}:${userId}`;
}

async function scanKeys(pattern: string) {
  const redis = getRedisConnection();
  const keys: string[] = [];
  let cursor = "0";

  do {
    const [nextCursor, batch] = await redis.scan(
      cursor,
      "MATCH",
      pattern,
      "COUNT",
      100,
    );
    cursor = nextCursor;
    keys.push(...batch);
  } while (cursor !== "0");

  return keys;
}

function parseJsonRecord<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

async function hydratePresenceUsers<T extends { userId: string }>(
  companyId: string,
  records: T[],
) {
  const userIds = [...new Set(records.map((record) => record.userId))];

  if (userIds.length === 0) return [];

  const members = await prisma.companyUser.findMany({
    where: {
      companyId,
      userId: { in: userIds },
    },
    select: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
  const usersById = new Map(members.map((member) => [member.user.id, member.user]));

  return records
    .map((record) => {
      const user = usersById.get(record.userId);

      if (!user) return null;

      return {
        ...record,
        name: user.name,
        email: user.email,
      };
    })
    .filter(
      (
        record,
      ): record is T & {
        name: string | null;
        email: string;
      } => record !== null,
    );
}

export async function heartbeatAgentPresence({
  companyId,
  userId,
  status = "AVAILABLE",
  activeContactId = null,
}: {
  companyId: string;
  userId: string;
  status?: InboxAgentAvailabilityStatus;
  activeContactId?: string | null;
}) {
  const redis = getRedisConnection();
  const payload: InboxPresenceRecord = {
    userId,
    status,
    activeContactId,
    lastSeenAt: new Date().toISOString(),
  };

  await redis.set(
    presenceKey(companyId, userId),
    JSON.stringify(payload),
    "EX",
    PRESENCE_TTL_SECONDS,
  );

  return payload;
}

export async function setAgentAvailability({
  companyId,
  userId,
  status,
  activeContactId = null,
}: {
  companyId: string;
  userId: string;
  status: InboxAgentAvailabilityStatus;
  activeContactId?: string | null;
}) {
  const presence = await heartbeatAgentPresence({
    companyId,
    userId,
    status,
    activeContactId,
  });

  await prisma.inboxAgentProfile.upsert({
    where: {
      companyId_userId: {
        companyId,
        userId,
      },
    },
    update: {
      availabilityStatus: status,
      lastSeenAt: new Date(),
    },
    create: {
      companyId,
      userId,
      availabilityStatus: status,
      lastSeenAt: new Date(),
    },
  });

  return presence;
}

export async function getCompanyAgentPresence(companyId: string) {
  const redis = getRedisConnection();
  const keys = await scanKeys(`inbox:presence:${companyId}:*`);

  if (keys.length === 0) return [];

  const values = await redis.mget(...keys);
  const records = values
    .map((value) => parseJsonRecord<InboxPresenceRecord>(value))
    .filter((record): record is InboxPresenceRecord => Boolean(record));
  const hydrated = await hydratePresenceUsers(companyId, records);

  return hydrated.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export async function heartbeatConversationViewer({
  companyId,
  contactId,
  userId,
}: {
  companyId: string;
  contactId: string;
  userId: string;
}) {
  const redis = getRedisConnection();
  const payload = {
    userId,
    lastSeenAt: new Date().toISOString(),
  };

  await redis.set(
    viewerKey(companyId, contactId, userId),
    JSON.stringify(payload),
    "EX",
    VIEWER_TTL_SECONDS,
  );

  return payload;
}

export async function getConversationViewers(
  companyId: string,
  contactId: string,
) {
  const redis = getRedisConnection();
  const keys = await scanKeys(`inbox:viewer:${companyId}:${contactId}:*`);

  if (keys.length === 0) return [];

  const values = await redis.mget(...keys);
  const records = values
    .map((value) =>
      parseJsonRecord<{ userId: string; lastSeenAt: string }>(value),
    )
    .filter((record): record is { userId: string; lastSeenAt: string } =>
      Boolean(record),
    );
  const hydrated = await hydratePresenceUsers(companyId, records);

  return hydrated.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export async function setConversationTyping({
  companyId,
  contactId,
  userId,
  isTyping,
}: {
  companyId: string;
  contactId: string;
  userId: string;
  isTyping: boolean;
}) {
  const redis = getRedisConnection();
  const key = typingKey(companyId, contactId, userId);

  if (!isTyping) {
    await redis.del(key);
    return null;
  }

  const payload = {
    userId,
    lastSeenAt: new Date().toISOString(),
  };

  await redis.set(key, JSON.stringify(payload), "EX", TYPING_TTL_SECONDS);

  return payload;
}

export async function getConversationTyping(
  companyId: string,
  contactId: string,
) {
  const redis = getRedisConnection();
  const keys = await scanKeys(`inbox:typing:${companyId}:${contactId}:*`);

  if (keys.length === 0) return [];

  const values = await redis.mget(...keys);
  const records = values
    .map((value) =>
      parseJsonRecord<{ userId: string; lastSeenAt: string }>(value),
    )
    .filter((record): record is { userId: string; lastSeenAt: string } =>
      Boolean(record),
    );
  const hydrated = await hydratePresenceUsers(companyId, records);

  return hydrated.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}
