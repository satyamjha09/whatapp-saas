import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { getMessageQueue } from "@/lib/queue";
import { recordContactActivity } from "@/server/services/contact-activity.service";
import { assertCompanyMessageQuota } from "@/server/services/message-quota.service";
import { assertSubscriptionCanSend } from "@/server/services/subscription-expiry.service";
import {
  assertUsageQuotaAvailable,
  incrementUsageQuota,
} from "@/server/services/usage-quota.service";
import { safeJson } from "@/server/services/automation-context.service";

function validateCustomerServiceWindow(contact: {
  inboxLastCustomerMessageAt?: Date | null;
}) {
  const startedAt = contact.inboxLastCustomerMessageAt;
  const endsAt = startedAt
    ? new Date(startedAt.getTime() + 24 * 60 * 60 * 1000)
    : null;

  if (!endsAt || endsAt <= new Date()) {
    throw new Error("Customer service window has expired");
  }
}

export async function createQueuedAutomationOutboundMessage({
  body,
  companyId,
  contactId,
  description,
  executionId,
  metadata,
  nodeId,
  sessionId,
  templateId,
  variables = [],
}: {
  body: string;
  companyId: string;
  contactId: string;
  description: string;
  executionId: string;
  metadata?: Record<string, unknown>;
  nodeId: string;
  sessionId: string;
  templateId?: string | null;
  variables?: string[];
}) {
  await assertSubscriptionCanSend(companyId);
  await assertCompanyMessageQuota(companyId);
  await assertUsageQuotaAvailable({
    amount: 1,
    companyId,
    featureKey: "BULK_MESSAGING",
  });

  const contact = await prisma.contact.findFirst({
    where: {
      companyId,
      id: contactId,
    },
  });

  if (!contact) {
    throw new Error("Automation contact not found");
  }

  if (!templateId) {
    validateCustomerServiceWindow(contact);
  }

  const dedupeKey = `automation:${executionId}:${nodeId}:outbound`;
  const existingEvent = await prisma.messageEvent.findUnique({
    where: {
      dedupeKey,
    },
    include: {
      message: true,
    },
  });

  if (existingEvent?.message) {
    await getMessageQueue().add(
      templateId ? "send-template-message" : "send-session-message",
      {
        companyId,
        messageId: existingEvent.message.id,
      },
      {
        jobId: existingEvent.message.id,
      },
    );

    return existingEvent.message;
  }

  const message = await prisma.$transaction(async (tx) => {
    await tx.wallet.upsert({
      where: {
        companyId,
      },
      update: {},
      create: {
        balancePaise: 0,
        companyId,
      },
    });

    const debit = await tx.wallet.updateMany({
      where: {
        balancePaise: {
          gte: MESSAGE_PRICE_PAISE,
        },
        companyId,
      },
      data: {
        balancePaise: {
          decrement: MESSAGE_PRICE_PAISE,
        },
      },
    });

    if (debit.count !== 1) {
      throw new Error("Insufficient wallet balance for automation message");
    }

    const createdMessage = await tx.message.create({
      data: {
        body,
        companyId,
        contactId,
        direction: "OUTBOUND",
        metadata: safeJson({
          automationExecutionId: executionId,
          automationNodeId: nodeId,
          automationSessionId: sessionId,
          source: "automation_runtime",
          ...(metadata ?? {}),
        }),
        status: "QUEUED",
        templateId: templateId ?? undefined,
        toPhoneNumber: `${contact.countryCode}${contact.phoneNumber}`,
        variables,
        events: {
          create: {
            companyId,
            dedupeKey,
            raw: {
              automationExecutionId: executionId,
              automationNodeId: nodeId,
              automationSessionId: sessionId,
              reason: description,
              source: "automation_runtime",
            },
            status: "QUEUED",
          },
        },
      },
    });

    const walletTransaction = await tx.walletTransaction.create({
      data: {
        amountPaise: MESSAGE_PRICE_PAISE,
        companyId,
        description,
        referenceId: createdMessage.id,
        referenceType: "MESSAGE_USAGE",
        status: "SUCCESS",
        type: "DEBIT",
      },
    });

    await tx.messageUsageLedger.create({
      data: {
        amountPaise: MESSAGE_PRICE_PAISE,
        companyId,
        messageId: createdMessage.id,
        status: "CHARGED",
        walletTransactionId: walletTransaction.id,
      },
    });

    return createdMessage;
  });

  await getMessageQueue().add(
    templateId ? "send-template-message" : "send-session-message",
    {
      companyId,
      messageId: message.id,
    },
    {
      jobId: message.id,
    },
  );

  await incrementUsageQuota({
    amount: 1,
    companyId,
    featureKey: "BULK_MESSAGING",
    idempotencyKey: `message-created:${message.id}`,
    metadata: {
      automationExecutionId: executionId,
      contactId: message.contactId,
      messageId: message.id,
      nodeId,
      sessionId,
    },
    reason: "message-created",
  });

  await prisma.contact.update({
    where: {
      id: contact.id,
    },
    data: {
      lastRepliedAt: new Date(),
    },
  });

  await recordContactActivity({
    companyId,
    contactId: contact.id,
    metadata: {
      automationExecutionId: executionId,
      messageId: message.id,
      nodeId,
      sessionId,
    },
    title: templateId ? "Automation sent template" : "Automation sent message",
    type: "MESSAGE_OUTBOUND",
  });

  return message;
}
