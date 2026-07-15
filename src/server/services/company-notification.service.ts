import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { enqueueCompanyNotificationEmails } from "@/server/services/company-notification-email.service";
import { shouldCreateRecipientForNotification } from "@/server/services/company-notification-preference.service";

type NotificationType =
  | "BILLING"
  | "WALLET"
  | "WEBHOOK"
  | "DEVELOPER_API"
  | "CAMPAIGN"
  | "INBOX"
  | "SYSTEM";

type NotificationSeverity = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

async function ensureCompanyNotificationRecipients({
  companyId,
  notificationId,
}: {
  companyId: string;
  notificationId: string;
}) {
  const notification = await prisma.companyNotification.findUnique({
    where: { id: notificationId },
    select: { type: true, severity: true },
  });

  if (!notification) return;

  const recipients = await prisma.companyUser.findMany({
    where: {
      companyId,
      role: { in: ["OWNER", "ADMIN"] },
    },
    select: { userId: true },
  });

  const allowedRecipients: typeof recipients = [];

  for (const recipient of recipients) {
    const shouldCreate = await shouldCreateRecipientForNotification({
      companyId,
      userId: recipient.userId,
      type: notification.type,
      severity: notification.severity,
    });

    if (shouldCreate) allowedRecipients.push(recipient);
  }

  if (allowedRecipients.length === 0) return;

  await prisma.companyNotificationRecipient.createMany({
    data: allowedRecipients.map((recipient) => ({
      notificationId,
      userId: recipient.userId,
    })),
    skipDuplicates: true,
  });
}

export async function createCompanyNotification({
  companyId,
  type,
  severity = "INFO",
  title,
  message,
  actionHref,
  idempotencyKey,
  metadata,
}: {
  companyId: string;
  type: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  actionHref?: string | null;
  idempotencyKey?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const notification = idempotencyKey
    ? await prisma.companyNotification.upsert({
        where: {
          companyId_idempotencyKey: { companyId, idempotencyKey },
        },
        update: {},
        create: {
          companyId,
          type,
          severity,
          title,
          message,
          actionHref: actionHref ?? null,
          idempotencyKey,
          metadata,
        },
      })
    : await prisma.companyNotification.create({
        data: {
          companyId,
          type,
          severity,
          title,
          message,
          actionHref: actionHref ?? null,
          idempotencyKey: null,
          metadata,
        },
      });

  await ensureCompanyNotificationRecipients({
    companyId,
    notificationId: notification.id,
  });

  try {
    await enqueueCompanyNotificationEmails({
      companyId,
      notificationId: notification.id,
    });
  } catch (error) {
    console.error("COMPANY_NOTIFICATION_EMAIL_ENQUEUE_ERROR:", error);
  }

  return notification;
}

export async function createTargetedCompanyNotification({
  companyId,
  userIds,
  type,
  severity = "INFO",
  title,
  message,
  actionHref,
  idempotencyKey,
  metadata,
}: {
  companyId: string;
  userIds: string[];
  type: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  message: string;
  actionHref?: string | null;
  idempotencyKey?: string | null;
  metadata?: Prisma.InputJsonValue;
}) {
  const notification = idempotencyKey
    ? await prisma.companyNotification.upsert({
        where: {
          companyId_idempotencyKey: { companyId, idempotencyKey },
        },
        update: {},
        create: {
          companyId,
          type,
          severity,
          title,
          message,
          actionHref: actionHref ?? null,
          idempotencyKey,
          metadata,
        },
      })
    : await prisma.companyNotification.create({
        data: {
          companyId,
          type,
          severity,
          title,
          message,
          actionHref: actionHref ?? null,
          idempotencyKey: null,
          metadata,
        },
      });

  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const allowedUserIds: string[] = [];

  for (const userId of uniqueUserIds) {
    const shouldCreate = await shouldCreateRecipientForNotification({
      companyId,
      userId,
      type: notification.type,
      severity: notification.severity,
    });

    if (shouldCreate) allowedUserIds.push(userId);
  }

  if (allowedUserIds.length > 0) {
    await prisma.companyNotificationRecipient.createMany({
      data: allowedUserIds.map((userId) => ({
        notificationId: notification.id,
        userId,
      })),
      skipDuplicates: true,
    });

    try {
      await enqueueCompanyNotificationEmails({
        companyId,
        notificationId: notification.id,
      });
    } catch (error) {
      console.error("COMPANY_NOTIFICATION_EMAIL_ENQUEUE_ERROR:", error);
    }
  }

  return notification;
}

export async function backfillCompanyNotificationRecipients(companyId: string) {
  const notifications = await prisma.companyNotification.findMany({
    where: { companyId },
    select: { id: true },
    take: 500,
    orderBy: { createdAt: "desc" },
  });

  for (const notification of notifications) {
    await ensureCompanyNotificationRecipients({
      companyId,
      notificationId: notification.id,
    });
  }
}

export async function getCompanyNotificationCenter({
  companyId,
  userId,
}: {
  companyId: string;
  userId: string;
}) {
  await backfillCompanyNotificationRecipients(companyId);

  const [recipients, unreadCount] = await Promise.all([
    prisma.companyNotificationRecipient.findMany({
      where: {
        userId,
        status: { not: "ARCHIVED" },
        notification: { companyId },
      },
      include: { notification: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.companyNotificationRecipient.count({
      where: {
        userId,
        status: "UNREAD",
        notification: { companyId },
      },
    }),
  ]);

  return {
    unreadCount,
    notifications: recipients.map((recipient) => ({
      ...recipient.notification,
      status: recipient.status,
      readAt: recipient.readAt,
      archivedAt: recipient.archivedAt,
      recipientId: recipient.id,
    })),
  };
}

export async function getUnreadCompanyNotificationCount({
  companyId,
  userId,
}: {
  companyId: string;
  userId: string;
}) {
  await backfillCompanyNotificationRecipients(companyId);

  return prisma.companyNotificationRecipient.count({
    where: {
      userId,
      status: "UNREAD",
      notification: { companyId },
    },
  });
}

export async function markCompanyNotificationRead({
  companyId,
  userId,
  notificationId,
}: {
  companyId: string;
  userId: string;
  notificationId: string;
}) {
  return prisma.companyNotificationRecipient.updateMany({
    where: {
      userId,
      notificationId,
      status: "UNREAD",
      notification: { companyId },
    },
    data: { status: "READ", readAt: new Date() },
  });
}

export async function archiveCompanyNotification({
  companyId,
  userId,
  notificationId,
}: {
  companyId: string;
  userId: string;
  notificationId: string;
}) {
  return prisma.companyNotificationRecipient.updateMany({
    where: {
      userId,
      notificationId,
      notification: { companyId },
    },
    data: { status: "ARCHIVED", archivedAt: new Date() },
  });
}

export async function markAllCompanyNotificationsRead({
  companyId,
  userId,
}: {
  companyId: string;
  userId: string;
}) {
  return prisma.companyNotificationRecipient.updateMany({
    where: {
      userId,
      status: "UNREAD",
      notification: { companyId },
    },
    data: { status: "READ", readAt: new Date() },
  });
}
