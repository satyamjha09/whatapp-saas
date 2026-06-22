import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { getMessageQueue } from "@/lib/queue";

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

export async function cancelScheduledCampaign(
  companyId: string,
  batchId: string,
) {
  const batch = await prisma.bulkMessageBatch.findFirst({
    where: { id: batchId, companyId },
    include: { recipients: true },
  });

  if (!batch) throw new Error("Campaign not found");
  if (batch.status !== "SCHEDULED") {
    throw new Error("Only scheduled campaigns can be canceled");
  }

  const messageIds = batch.recipients.flatMap((recipient) =>
    recipient.messageId ? [recipient.messageId] : [],
  );
  const refundAmountPaise = batch.queuedCount * MESSAGE_PRICE_PAISE;
  const canceledAt = new Date();

  const canceledRecipientsCount = await prisma.$transaction(async (tx) => {
    const claimedBatch = await tx.bulkMessageBatch.updateMany({
      where: { id: batch.id, companyId, status: "SCHEDULED" },
      data: { status: "CANCELED", canceledAt },
    });

    if (claimedBatch.count !== 1) {
      throw new Error("Only scheduled campaigns can be canceled");
    }

    const canceledRecipients = await tx.bulkMessageBatchRecipient.updateMany({
      where: {
        batchId: batch.id,
        status: { in: ["SCHEDULED", "QUEUED"] },
      },
      data: { status: "CANCELED" },
    });

    if (messageIds.length > 0) {
      await tx.message.updateMany({
        where: {
          id: { in: messageIds },
          companyId,
          status: "QUEUED",
        },
        data: { status: "CANCELED" },
      });
    }

    if (refundAmountPaise > 0) {
      await tx.wallet.update({
        where: { companyId },
        data: { balancePaise: { increment: refundAmountPaise } },
      });
      await tx.walletTransaction.create({
        data: {
          companyId,
          type: "REFUND",
          status: "SUCCESS",
          amountPaise: refundAmountPaise,
          description: "Scheduled bulk campaign cancellation refund",
          referenceId: batch.id,
        },
      });
    }

    return canceledRecipients.count;
  });

  const jobRemovalResults = await Promise.all(
    batch.recipients.map(async (recipient) => {
      if (!recipient.queueJobId) return "missing" as const;
      return removeDelayedJob(recipient.queueJobId);
    }),
  );

  return {
    batchId: batch.id,
    removedJobsCount: jobRemovalResults.filter((result) => result === "removed")
      .length,
    failedToRemoveJobsCount: jobRemovalResults.filter(
      (result) => result === "failed",
    ).length,
    canceledRecipientsCount,
    refundAmountPaise,
  };
}
