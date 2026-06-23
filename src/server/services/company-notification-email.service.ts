import { prisma } from "@/lib/prisma";
import { getNotificationEmailQueue } from "@/server/queues/notification-email.queue";
import { shouldSendEmailForNotification } from "@/server/services/company-notification-preference.service";
import { buildNotificationEmailContent } from "@/server/services/notification-email-template.service";
import { toAbsoluteAppUrl } from "@/server/utils/app-url";

function buildNotificationSubject(title: string) {
  return `[TallyKonnect] ${title}`;
}

export async function enqueueCompanyNotificationEmails({
  companyId,
  notificationId,
}: {
  companyId: string;
  notificationId: string;
}) {
  const notification = await prisma.companyNotification.findFirst({
    where: {
      id: notificationId,
      companyId,
    },
  });

  if (!notification) {
    return {
      queuedCount: 0,
    };
  }

  const members = await prisma.companyUser.findMany({
    where: {
      companyId,
      role: {
        in: ["OWNER", "ADMIN"],
      },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  let queuedCount = 0;

  for (const member of members) {
    if (!member.user.email) {
      continue;
    }

    const shouldSend = await shouldSendEmailForNotification({
      companyId,
      userId: member.userId,
      type: notification.type,
      severity: notification.severity,
    });

    if (!shouldSend) {
      continue;
    }

    const delivery = await prisma.companyNotificationEmailDelivery.upsert({
      where: {
        notificationId_userId: {
          notificationId: notification.id,
          userId: member.userId,
        },
      },
      update: {},
      create: {
        companyId,
        notificationId: notification.id,
        userId: member.userId,
        toEmail: member.user.email,
        subject: buildNotificationSubject(notification.title),
        actionUrl: toAbsoluteAppUrl(notification.actionHref),
      },
    });

    if (delivery.status === "SENT") {
      continue;
    }

    await getNotificationEmailQueue().add(
      "send-notification-email",
      {
        deliveryId: delivery.id,
      },
      {
        jobId: delivery.id,
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

    queuedCount += 1;
  }

  return {
    queuedCount,
  };
}

export async function processCompanyNotificationEmailDelivery(
  deliveryId: string,
) {
  const delivery = await prisma.companyNotificationEmailDelivery.findUnique({
    where: {
      id: deliveryId,
    },
    include: {
      notification: true,
    },
  });

  if (!delivery) {
    return {
      skipped: true,
      reason: "Delivery not found",
    };
  }

  if (delivery.status === "SENT") {
    return {
      skipped: true,
      reason: "Already sent",
    };
  }

  if (process.env.NOTIFICATION_EMAILS_ENABLED !== "true") {
    await prisma.companyNotificationEmailDelivery.update({
      where: {
        id: delivery.id,
      },
      data: {
        status: "SKIPPED",
        skippedAt: new Date(),
        lastError: "Notification emails are disabled",
      },
    });

    return {
      skipped: true,
      reason: "Notification emails are disabled",
    };
  }

  await prisma.companyNotificationEmailDelivery.update({
    where: {
      id: delivery.id,
    },
    data: {
      attempts: {
        increment: 1,
      },
      lastError: null,
    },
  });

  try {
    const { sendTransactionalEmail } = await import(
      "@/server/services/transactional-email.service"
    );

    const emailContent = buildNotificationEmailContent({
      title: delivery.notification.title,
      message: delivery.notification.message,
      severity: delivery.notification.severity,
      type: delivery.notification.type,
      actionHref: delivery.notification.actionHref,
    });

    await sendTransactionalEmail({
      to: delivery.toEmail,
      subject: delivery.subject,
      text: emailContent.text,
      html: emailContent.html,
    });

    await prisma.companyNotificationEmailDelivery.update({
      where: {
        id: delivery.id,
      },
      data: {
        status: "SENT",
        sentAt: new Date(),
        lastError: null,
      },
    });

    return {
      sent: true,
      deliveryId: delivery.id,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown email error";

    await prisma.companyNotificationEmailDelivery.update({
      where: {
        id: delivery.id,
      },
      data: {
        status: "FAILED",
        lastError: errorMessage.slice(0, 1000),
      },
    });

    throw error;
  }
}
