import { prisma } from "@/lib/prisma";

const AUTO_ARCHIVE_READ_AFTER_DAYS = 30;
const DELETE_OLD_RESOLVED_AFTER_DAYS = 180;

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1_000);
}

export async function cleanupCompanyNotificationRetention({
  companyId,
}: {
  companyId: string;
}) {
  const autoArchiveCutoff = daysAgo(AUTO_ARCHIVE_READ_AFTER_DAYS);
  const deleteCutoff = daysAgo(DELETE_OLD_RESOLVED_AFTER_DAYS);

  const autoArchivedRecipients =
    await prisma.companyNotificationRecipient.updateMany({
      where: {
        status: "READ",
        readAt: { lt: autoArchiveCutoff },
        notification: { companyId },
      },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });

  const deletedResolvedNotifications =
    await prisma.companyNotification.deleteMany({
      where: {
        companyId,
        createdAt: { lt: deleteCutoff },
        recipients: { none: { status: "UNREAD" } },
      },
    });

  return {
    companyId,
    autoArchiveReadAfterDays: AUTO_ARCHIVE_READ_AFTER_DAYS,
    deleteOldResolvedAfterDays: DELETE_OLD_RESOLVED_AFTER_DAYS,
    autoArchivedRecipients: autoArchivedRecipients.count,
    deletedResolvedNotifications: deletedResolvedNotifications.count,
  };
}

export async function cleanupCompanyNotificationRetentionForAllCompanies({
  limit = 500,
}: {
  limit?: number;
} = {}) {
  const companies = await prisma.company.findMany({
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  const results = [];

  for (const company of companies) {
    results.push(
      await cleanupCompanyNotificationRetention({ companyId: company.id }),
    );
  }

  return {
    checkedCount: companies.length,
    recoveredCount: results.reduce(
      (total, result) =>
        total +
        result.autoArchivedRecipients +
        result.deletedResolvedNotifications,
      0,
    ),
    results,
  };
}
