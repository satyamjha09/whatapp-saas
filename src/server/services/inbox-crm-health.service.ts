import { prisma } from "@/lib/prisma";

export async function getInboxCrmHealth() {
  const [activities24h, savedViews, contactsWithLifecycle] = await Promise.all([
    prisma.contactActivity.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.inboxSavedView.count(),
    prisma.contact.count({
      where: {
        lifecycleStage: {
          not: "LEAD",
        },
      },
    }),
  ]);

  return {
    enabled: true,
    isHealthy: true,
    activities24h,
    savedViews,
    contactsWithLifecycle,
  };
}
