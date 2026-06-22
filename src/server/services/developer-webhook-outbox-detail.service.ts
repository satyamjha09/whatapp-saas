import { prisma } from "@/lib/prisma";

export async function getDeveloperWebhookOutboxEventDetail({
  companyId,
  outboxEventId,
}: {
  companyId: string;
  outboxEventId: string;
}) {
  return prisma.developerWebhookOutbox.findFirst({
    where: {
      id: outboxEventId,
      companyId,
    },
    include: {
      deliveries: {
        orderBy: { createdAt: "desc" },
        include: {
          endpoint: {
            select: {
              id: true,
              name: true,
              url: true,
              status: true,
              autoDisabledAt: true,
              consecutiveFailureCount: true,
            },
          },
        },
      },
    },
  });
}
