import type { MessageStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const statusRank = {
  SCHEDULED: -1,
  QUEUED: 0,
  SENDING: 1,
  SENT: 2,
  DELIVERED: 3,
  READ: 4,
  FAILED: 5,
  CANCELED: 6,
} as const;

type TrackedRecipientStatus = keyof typeof statusRank;

function toRecipientStatus(
  status: MessageStatus,
): TrackedRecipientStatus | null {
  return status in statusRank ? (status as TrackedRecipientStatus) : null;
}

export async function updateBulkMessageRecipientTracking(
  messageId: string,
  messageStatus: MessageStatus,
  errorMessage?: string,
) {
  const nextStatus = toRecipientStatus(messageStatus);

  if (!nextStatus) return;

  await prisma.$transaction(async (tx) => {
    const recipient = await tx.bulkMessageBatchRecipient.findUnique({
      where: { messageId },
      select: { id: true, batchId: true, status: true },
    });

    if (!recipient || recipient.status === "SKIPPED_DUPLICATE") return;

    const currentStatus = recipient.status as TrackedRecipientStatus;

    if (
      currentStatus === nextStatus ||
      currentStatus === "FAILED" ||
      currentStatus === "CANCELED" ||
      (nextStatus !== "FAILED" &&
        statusRank[nextStatus] <= statusRank[currentStatus])
    ) {
      return;
    }

    await tx.bulkMessageBatchRecipient.update({
      where: { id: recipient.id },
      data: {
        status: nextStatus,
        errorMessage: nextStatus === "FAILED" ? errorMessage : null,
      },
    });

    if (currentStatus === "SCHEDULED") {
      await tx.bulkMessageBatch.updateMany({
        where: { id: recipient.batchId, status: "SCHEDULED" },
        data: { status: "QUEUED" },
      });
    }

    if (nextStatus === "FAILED") {
      const batch = await tx.bulkMessageBatch.update({
        where: { id: recipient.batchId },
        data: { failedCount: { increment: 1 } },
        select: { failedCount: true, queuedCount: true },
      });

      await tx.bulkMessageBatch.update({
        where: { id: recipient.batchId },
        data: {
          status:
            batch.failedCount >= batch.queuedCount
              ? "FAILED"
              : "PARTIAL_FAILED",
        },
      });
    }
  });
}
