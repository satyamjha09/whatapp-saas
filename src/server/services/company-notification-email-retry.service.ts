import { prisma } from "@/lib/prisma";
import { getNotificationEmailQueue } from "@/server/queues/notification-email.queue";

export async function retryCompanyNotificationEmailDelivery({
  companyId,
  deliveryId,
}: {
  companyId: string;
  deliveryId: string;
}) {
  const delivery = await prisma.companyNotificationEmailDelivery.findFirst({
    where: {
      id: deliveryId,
      companyId,
    },
  });

  if (!delivery) {
    throw new Error("Email delivery not found");
  }

  if (delivery.status === "SENT") {
    throw new Error("Sent email deliveries cannot be retried");
  }

  const updatedDelivery = await prisma.companyNotificationEmailDelivery.update({
    where: {
      id: delivery.id,
    },
    data: {
      status: "PENDING",
      lastError: null,
      skippedAt: null,
    },
  });

  await getNotificationEmailQueue().add(
    "send-notification-email",
    {
      deliveryId: updatedDelivery.id,
    },
    {
      jobId: `${updatedDelivery.id}:retry:${Date.now()}`,
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 60_000,
      },
      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 500,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
        count: 1000,
      },
    },
  );

  return updatedDelivery;
}

export async function retryFailedCompanyNotificationEmailDeliveries({
  companyId,
  limit = 100,
}: {
  companyId: string;
  limit?: number;
}) {
  const deliveries = await prisma.companyNotificationEmailDelivery.findMany({
    where: {
      companyId,
      status: {
        in: ["FAILED", "SKIPPED"],
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
  });

  const retried = [];

  for (const delivery of deliveries) {
    const updatedDelivery = await retryCompanyNotificationEmailDelivery({
      companyId,
      deliveryId: delivery.id,
    });

    retried.push(updatedDelivery);
  }

  return {
    retriedCount: retried.length,
    retried,
  };
}
