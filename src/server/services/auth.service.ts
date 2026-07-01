import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getRedisConnection } from "@/lib/redis";

type SyncUserInput = {
  clerkUserId: string;
  email: string;
  name?: string | null;
  imageUrl?: string | null;
  mobile?: string | null;
};

type UpdateUserProfileInput = {
  name: string;
  mobile?: string | null;
};

const USER_CACHE_TTL_SECONDS = 60 * 5;

type CachedUser = Omit<User, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

function userCacheKey(clerkUserId: string) {
  return `auth:user:clerk:${clerkUserId}`;
}

function serializeUser(user: User): CachedUser {
  return {
    ...user,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function deserializeUser(user: CachedUser): User {
  return {
    ...user,
    createdAt: new Date(user.createdAt),
    updatedAt: new Date(user.updatedAt),
  };
}

async function getCachedUser(clerkUserId: string) {
  if (!process.env.REDIS_URL) {
    return null;
  }

  try {
    const cached = await getRedisConnection().get(userCacheKey(clerkUserId));

    if (!cached) {
      return null;
    }

    return deserializeUser(JSON.parse(cached) as CachedUser);
  } catch (error) {
    console.error(
      "AUTH_USER_CACHE_READ_ERROR:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

async function setCachedUser(user: User) {
  if (!process.env.REDIS_URL) {
    return;
  }

  try {
    await getRedisConnection().set(
      userCacheKey(user.clerkUserId),
      JSON.stringify(serializeUser(user)),
      "EX",
      USER_CACHE_TTL_SECONDS,
    );
  } catch (error) {
    console.error(
      "AUTH_USER_CACHE_WRITE_ERROR:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function invalidateCachedUser(clerkUserId: string) {
  if (!process.env.REDIS_URL) {
    return;
  }

  try {
    await getRedisConnection().del(userCacheKey(clerkUserId));
  } catch (error) {
    console.error(
      "AUTH_USER_CACHE_INVALIDATE_ERROR:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function getUserByClerkId(clerkUserId: string) {
  const cachedUser = await getCachedUser(clerkUserId);

  if (cachedUser) {
    return cachedUser;
  }

  const user = await prisma.user.findUnique({
    where: {
      clerkUserId,
    },
  });

  if (user) {
    await setCachedUser(user);
  }

  return user;
}

export async function syncUser(input: SyncUserInput) {
  const user = await prisma.user.upsert({
    where: {
      clerkUserId: input.clerkUserId,
    },
    update: {
      email: input.email,
      name: input.name,
      imageUrl: input.imageUrl,
      mobile: input.mobile ?? undefined,
    },
    create: {
      clerkUserId: input.clerkUserId,
      email: input.email,
      name: input.name,
      imageUrl: input.imageUrl,
      mobile: input.mobile ?? undefined,
    },
  });

  await setCachedUser(user);

  return user;
}

export async function updateUserProfile(
  userId: string,
  input: UpdateUserProfileInput,
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      mobile: input.mobile,
    },
  });

  await setCachedUser(user);

  return user;
}
