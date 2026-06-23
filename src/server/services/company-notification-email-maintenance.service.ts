import { prisma } from "@/lib/prisma";
import { getNotificationEmailQueue } from "@/server/queues/notification-email.queue";

const STALE_PENDING_AFTER_MINUTES = 30;
const DELETE_SENT_AFTER_DAYS = 90;
const DELETE_SKIPPED_AFTER_DAYS = 90;
const DELETE_FAILED_AFTER_DAYS = 180;

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function recoverStaleNotificationEmailDeliveries({
  staleAfterMinutes = STALE_PENDING_AFTER_MINUTES,
  limit = 500,
}: {
  staleAfterMinutes?: number;
  limit?: number;
} = {}) {
  const staleCutoff = minutesAgo(staleAfterMinutes);

  const staleDeliveries =
    await prisma.companyNotificationEmailDelivery.findMany({
      where: {
        status: "PENDING",
        updatedAt: {
          lt: staleCutoff,
        },
      },
      orderBy: {
        updatedAt: "asc",
      },
      take: limit,
    });

  const recovered = [];

  for (const delivery of staleDeliveries) {
    await getNotificationEmailQueue().add(
      "send-notification-email",
      {
        deliveryId: delivery.id,
      },
      {
        jobId: `${delivery.id}:stale-recovery:${Date.now()}`,
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

    recovered.push(delivery);
  }

  return {
    checkedCount: staleDeliveries.length,
    recoveredCount: recovered.length,
    recovered,
  };
}

export async function cleanupNotificationEmailDeliveryRetention({
  companyId,
}: {
  companyId: string;
}) {
  const sentCutoff = daysAgo(DELETE_SENT_AFTER_DAYS);
  const skippedCutoff = daysAgo(DELETE_SKIPPED_AFTER_DAYS);
  const failedCutoff = daysAgo(DELETE_FAILED_AFTER_DAYS);

  const [sent, skipped, failed] = await Promise.all([
    prisma.companyNotificationEmailDelivery.deleteMany({
      where: {
        companyId,
        status: "SENT",
        sentAt: {
          lt: sentCutoff,
        },
      },
    }),

    prisma.companyNotificationEmailDelivery.deleteMany({
      where: {
        companyId,
        status: "SKIPPED",
        skippedAt: {
          lt: skippedCutoff,
        },
      },
    }),

    prisma.companyNotificationEmailDelivery.deleteMany({
      where: {
        companyId,
        status: "FAILED",
        updatedAt: {
          lt: failedCutoff,
        },
      },
    }),
  ]);

  return {
    companyId,
    deleted: {
      sent: sent.count,
      skipped: skipped.count,
      failed: failed.count,
    },
  };
}

export async function cleanupNotificationEmailDeliveryRetentionForAllCompanies({
  limit = 500,
}: {
  limit?: number;
} = {}) {
  const companies = await prisma.company.findMany({
    select: {
      id: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
  });

  const results = [];

  for (const company of companies) {
    const result = await cleanupNotificationEmailDeliveryRetention({
      companyId: company.id,
    });

    results.push(result);
  }

  return {
    checkedCount: companies.length,
    recoveredCount: results.reduce((total, result) => {
      return (
        total +
        result.deleted.sent +
        result.deleted.skipped +
        result.deleted.failed
      );
    }, 0),
    results,
  };
}

export async function runNotificationEmailDeliveryMaintenance() {
  const [recovery, cleanup] = await Promise.all([
    recoverStaleNotificationEmailDeliveries({
      staleAfterMinutes: STALE_PENDING_AFTER_MINUTES,
      limit: 500,
    }),

    cleanupNotificationEmailDeliveryRetentionForAllCompanies({
      limit: 500,
    }),
  ]);

  return {
    checkedCount: recovery.checkedCount + cleanup.checkedCount,
    recoveredCount: recovery.recoveredCount + cleanup.recoveredCount,
    recovery,
    cleanup,
  };
}
