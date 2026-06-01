import { prisma } from "@/lib/prisma";

type SyncUserInput = {
  clerkUserId: string;
  email: string;
  name?: string | null;
  imageUrl?: string | null;
};

export async function syncUser(input: SyncUserInput) {
  return prisma.user.upsert({
    where: {
      clerkUserId: input.clerkUserId,
    },
    update: {
      email: input.email,
      name: input.name,
      imageUrl: input.imageUrl,
    },
    create: {
      clerkUserId: input.clerkUserId,
      email: input.email,
      name: input.name,
      imageUrl: input.imageUrl,
    },
  });
}
