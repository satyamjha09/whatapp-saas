import type { MessageStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

type MessageStatusSummary = {
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  canceled: number;
};

function createEmptySummary(): MessageStatusSummary {
  return {
    pending: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    canceled: 0,
  };
}

function addMessageStatus(
  summary: MessageStatusSummary,
  status: MessageStatus,
) {
  if (status === "QUEUED" || status === "SENDING") summary.pending += 1;
  else if (status === "SENT") summary.sent += 1;
  else if (status === "DELIVERED") summary.delivered += 1;
  else if (status === "READ") summary.read += 1;
  else if (status === "FAILED") summary.failed += 1;
  else if (status === "CANCELED") summary.canceled += 1;
}

function calculateRate(numerator: number, denominator: number) {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

export async function getCampaignReportsByCompany(companyId: string) {
  const batches = await prisma.bulkMessageBatch.findMany({
    where: { companyId },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      recipients: {
        select: {
          message: { select: { status: true } },
        },
      },
    },
  });

  return batches.map((batch) => {
    const summary = createEmptySummary();

    for (const recipient of batch.recipients) {
      if (recipient.message) {
        addMessageStatus(summary, recipient.message.status);
      }
    }

    const deliveredOrRead = summary.delivered + summary.read;

    return {
      id: batch.id,
      templateName: batch.templateName,
      contactGroupName: batch.contactGroupName,
      status: batch.status,
      requestedCount: batch.requestedCount,
      queuedCount: batch.queuedCount,
      failedCount: batch.failedCount,
      skippedDuplicateCount: batch.skippedDuplicateCount,
      skippedBlockedCount: batch.skippedBlockedCount,
      scheduledAt: batch.scheduledAt,
      canceledAt: batch.canceledAt,
      createdAt: batch.createdAt,
      summary,
      deliveryRate: calculateRate(deliveredOrRead, batch.queuedCount),
      readRate: calculateRate(summary.read, batch.queuedCount),
      failureRate: calculateRate(summary.failed, batch.queuedCount),
    };
  });
}

export async function getCampaignReportDetail(
  companyId: string,
  batchId: string,
) {
  const batch = await prisma.bulkMessageBatch.findFirst({
    where: { id: batchId, companyId },
    include: {
      recipients: {
        orderBy: { createdAt: "asc" },
        take: 1000,
        include: {
          message: {
            select: {
              status: true,
              metaMessageId: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  });

  if (!batch) return null;

  const summary = createEmptySummary();
  const recipients = batch.recipients.map((recipient) => {
    if (recipient.message) {
      addMessageStatus(summary, recipient.message.status);
    }

    return {
      id: recipient.id,
      countryCode: recipient.countryCode,
      phoneNumber: recipient.phoneNumber,
      name: recipient.name,
      batchRecipientStatus: recipient.status,
      messageId: recipient.messageId,
      metaMessageId: recipient.message?.metaMessageId ?? null,
      messageStatus: recipient.message?.status ?? null,
      errorMessage: recipient.errorMessage,
      createdAt: recipient.message?.createdAt ?? recipient.createdAt,
      updatedAt: recipient.message?.updatedAt ?? recipient.updatedAt,
    };
  });

  const deliveredOrRead = summary.delivered + summary.read;

  return {
    batch,
    recipients,
    summary,
    deliveryRate: calculateRate(deliveredOrRead, batch.queuedCount),
    readRate: calculateRate(summary.read, batch.queuedCount),
    failureRate: calculateRate(summary.failed, batch.queuedCount),
  };
}
