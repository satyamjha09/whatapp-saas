import { prisma } from "@/lib/prisma";

export async function cleanupOldProviderWebhookEvents() {
  const succeededCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const failedCutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

  const succeededDeleted = await prisma.providerWebhookEvent.deleteMany({
    where: {
      status: "SUCCEEDED",
      receivedAt: {
        lt: succeededCutoff,
      },
    },
  });

  const failedDeleted = await prisma.providerWebhookEvent.deleteMany({
    where: {
      status: "FAILED",
      receivedAt: {
        lt: failedCutoff,
      },
    },
  });

  return {
    succeededDeleted: succeededDeleted.count,
    failedDeleted: failedDeleted.count,
  };
}
