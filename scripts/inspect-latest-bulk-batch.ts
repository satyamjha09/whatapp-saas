import "dotenv/config";
import { prisma } from "@/lib/prisma";

async function main() {
  const batch = await prisma.bulkMessageBatch.findFirst({
    orderBy: { createdAt: "desc" },
    include: {
      recipients: {
        include: {
          message: {
            select: {
              id: true,
              status: true,
              metaMessageId: true,
              toPhoneNumber: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        batchId: batch?.id,
        status: batch?.status,
        queuedCount: batch?.queuedCount,
        failedCount: batch?.failedCount,
        recipients: batch?.recipients.map((recipient) => ({
          phoneNumber: recipient.phoneNumber,
          status: recipient.status,
          messageStatus: recipient.message?.status,
          metaMessageId: recipient.message?.metaMessageId,
        })),
      },
      null,
      2,
    ),
  );
}

main().finally(() => prisma.$disconnect());
