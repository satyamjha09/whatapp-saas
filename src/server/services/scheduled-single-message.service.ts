import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { getMessageQueue } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { decrementUsageQuota } from "@/server/services/usage-quota.service";
import { refundWalletForMessage } from "@/server/services/wallet.service";

async function removeDelayedJob(queueJobId: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      (async () => {
        const job = await getMessageQueue().getJob(queueJobId);
        if (!job) return "missing" as const;
        await job.remove();
        return "removed" as const;
      })(),
      new Promise<"failed">((resolve) => {
        timeout = setTimeout(() => resolve("failed"), 5_000);
      }),
    ]);
  } catch {
    return "failed" as const;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function cancelScheduledSingleMessage(
  companyId: string,
  messageId: string,
) {
  const message = await prisma.message.findFirst({
    where: { id: messageId, companyId },
    select: {
      id: true,
      createdAt: true,
      scheduledAt: true,
      status: true,
    },
  });

  if (!message) throw new Error("Message not found");
  if (!message.scheduledAt || message.status !== "QUEUED") {
    throw new Error("Only queued scheduled messages can be canceled");
  }

  const canceledAt = new Date();
  const canceledMessage = await prisma.$transaction(async (tx) => {
    const claimed = await tx.message.updateMany({
      where: {
        id: message.id,
        companyId,
        scheduledAt: { not: null },
        status: "QUEUED",
      },
      data: {
        errorMessage: "Scheduled message canceled",
        status: "CANCELED",
      },
    });

    if (claimed.count !== 1) {
      throw new Error("Only queued scheduled messages can be canceled");
    }

    await tx.messageEvent.create({
      data: {
        companyId,
        messageId: message.id,
        status: "CANCELED",
        raw: {
          source: "scheduled_single_message_cancel",
          reason: "Scheduled message canceled",
          canceledAt: canceledAt.toISOString(),
        },
      },
    });

    return tx.message.findUniqueOrThrow({
      where: { id: message.id },
      select: {
        id: true,
        createdAt: true,
        scheduledAt: true,
        status: true,
      },
    });
  });

  const jobRemovalResult = await removeDelayedJob(message.id);
  const refund = await refundWalletForMessage(
    companyId,
    MESSAGE_PRICE_PAISE,
    "Scheduled single message cancellation refund",
    message.id,
  );
  const quotaRestoration = await decrementUsageQuota({
    companyId,
    featureKey: "BULK_MESSAGING",
    amount: 1,
    idempotencyKey: `scheduled-single-message-canceled:${message.id}`,
    periodDate: message.createdAt,
    reason: "scheduled-single-message-canceled",
    metadata: {
      messageId: message.id,
      createdAt: message.createdAt.toISOString(),
      scheduledAt: message.scheduledAt?.toISOString() ?? null,
      canceledAt: canceledAt.toISOString(),
    },
  });

  return {
    messageId: canceledMessage.id,
    scheduledAt: canceledMessage.scheduledAt,
    status: canceledMessage.status,
    jobRemovalResult,
    refundCreated: refund.refunded,
    refundTransactionId: refund.transaction?.id ?? null,
    quotaRestored: Boolean(quotaRestoration),
    quotaEventId: quotaRestoration?.id ?? null,
  };
}
