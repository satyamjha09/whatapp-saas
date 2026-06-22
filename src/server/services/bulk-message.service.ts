import { getMessageQueue } from "@/lib/queue";
import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { getBillingPlanConfig } from "@/server/config/billing-plans";
import { assertCompanyMessageQuota } from "@/server/services/message-quota.service";
import { assertSubscriptionCanSend } from "@/server/services/subscription-expiry.service";
import { assertCompanyFeature } from "@/server/services/feature-gate.service";
import type { SendBulkTemplateMessageInput } from "@/server/validators/bulk-message.validator";

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "");
}

function renderTemplateBody(body: string, parameters: string[]) {
  return body.replace(/{{(\d+)}}/g, (_, index: string) => {
    return parameters[Number(index) - 1] ?? `{{${index}}}`;
  });
}

export async function sendBulkTemplateMessages(
  companyId: string,
  input: SendBulkTemplateMessageInput,
  createdByUserId?: string,
) {
  await assertCompanyFeature(companyId, "BULK_CAMPAIGNS");
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { billingPlan: true },
  });

  if (!company) throw new Error("Company not found");

  const plan = getBillingPlanConfig(company.billingPlan);
  const contactGroup = input.groupId
    ? await prisma.contactGroup.findFirst({
        where: { id: input.groupId, companyId },
        include: {
          members: {
            orderBy: { createdAt: "asc" },
            take: plan.maxBulkRecipients + 1,
            include: {
              contact: {
                select: {
                  countryCode: true,
                  phoneNumber: true,
                  name: true,
                  isBlocked: true,
                },
              },
            },
          },
          _count: { select: { members: true } },
        },
      })
    : null;

  if (input.groupId && !contactGroup) {
    throw new Error("Contact group not found");
  }
  if (contactGroup?._count.members === 0) {
    throw new Error("Contact group has no contacts");
  }
  if (contactGroup && contactGroup._count.members > plan.maxBulkRecipients) {
    throw new Error(
      `Your ${plan.name} plan allows maximum ${plan.maxBulkRecipients.toLocaleString("en-IN")} bulk recipients`,
    );
  }

  const sourceRecipients = contactGroup
    ? contactGroup.members.map((member) => ({
        countryCode: member.contact.countryCode,
        phoneNumber: member.contact.phoneNumber,
        name: member.contact.name ?? undefined,
        bodyParameters: [] as string[],
        isBlocked: member.contact.isBlocked,
      }))
    : input.recipients.map((recipient) => ({
        ...recipient,
        isBlocked: false,
      }));
  const normalizedRecipients = sourceRecipients.map((recipient) => ({
    countryCode: normalizePhoneNumber(recipient.countryCode),
    phoneNumber: normalizePhoneNumber(recipient.phoneNumber),
    name: recipient.name || null,
    bodyParameters: recipient.bodyParameters,
    isBlocked: recipient.isBlocked,
  }));
  const blockedRecipients = normalizedRecipients.filter(
    (recipient) => recipient.isBlocked,
  );
  const sendableRecipients = normalizedRecipients.filter(
    (recipient) => !recipient.isBlocked,
  );
  const uniqueRecipientMap = new Map<string, (typeof normalizedRecipients)[number]>();
  const duplicateRecipients: typeof normalizedRecipients = [];

  for (const recipient of sendableRecipients) {
    const key = `${recipient.countryCode}${recipient.phoneNumber}`;

    if (uniqueRecipientMap.has(key)) {
      duplicateRecipients.push(recipient);
    } else {
      uniqueRecipientMap.set(key, recipient);
    }
  }

  const uniqueRecipients = Array.from(uniqueRecipientMap.values());
  const requestedCount = normalizedRecipients.length;

  if (uniqueRecipients.length === 0) {
    throw new Error("Contact group has no sendable contacts");
  }
  if (uniqueRecipients.length > plan.maxBulkRecipients) {
    throw new Error(
      `Your ${plan.name} plan allows maximum ${plan.maxBulkRecipients.toLocaleString("en-IN")} bulk recipients`,
    );
  }
  await assertSubscriptionCanSend(companyId);
  await assertCompanyMessageQuota(companyId, uniqueRecipients.length);
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const now = new Date();
  const isScheduled = Boolean(
    scheduledAt && scheduledAt.getTime() > now.getTime(),
  );
  const delay =
    isScheduled && scheduledAt
      ? Math.max(scheduledAt.getTime() - now.getTime(), 0)
      : 0;

  const [template, whatsAppAccount] = await Promise.all([
    prisma.template.findFirst({
      where: {
        id: input.templateId,
        companyId,
        status: "APPROVED",
      },
    }),
    prisma.whatsAppAccount.findFirst({
      where: {
        companyId,
        status: "CONNECTED",
        accessToken: { not: null },
        phoneNumbers: {
          some: { phoneNumberId: { not: null } },
        },
      },
      select: { id: true },
    }),
  ]);

  if (!template) throw new Error("Approved template not found");
  if (!whatsAppAccount) throw new Error("WhatsApp account is not connected");

  if (input.bodyParameters.length !== template.variables.length) {
    const allRecipientsHaveParameters = uniqueRecipients.every(
      (recipient) => recipient.bodyParameters.length > 0,
    );

    if (!allRecipientsHaveParameters) {
      throw new Error(
        `This template requires ${template.variables.length} parameter value(s)`,
      );
    }
  }

  const invalidRecipient = uniqueRecipients.find((recipient) => {
    const parameters = recipient.bodyParameters.length
      ? recipient.bodyParameters
      : input.bodyParameters;
    return parameters.length !== template.variables.length;
  });

  if (invalidRecipient) {
    throw new Error(
      `Recipient +${invalidRecipient.countryCode}${invalidRecipient.phoneNumber} requires ${template.variables.length} parameter value(s)`,
    );
  }

  const totalChargePaise = uniqueRecipients.length * MESSAGE_PRICE_PAISE;
  const transactionResult = await prisma.$transaction(
    async (tx) => {
      const debitResult = await tx.wallet.updateMany({
        where: {
          companyId,
          balancePaise: { gte: totalChargePaise },
        },
        data: { balancePaise: { decrement: totalChargePaise } },
      });

      if (debitResult.count !== 1) {
        throw new Error("Insufficient wallet balance");
      }

      const batch = await tx.bulkMessageBatch.create({
        data: {
          companyId,
          templateId: template.id,
          templateName: template.name,
          contactGroupId: contactGroup?.id ?? null,
          contactGroupName: contactGroup?.name ?? null,
          createdByUserId,
          status: isScheduled ? "SCHEDULED" : "QUEUED",
          scheduledAt: isScheduled ? scheduledAt : null,
          requestedCount,
          queuedCount: uniqueRecipients.length,
          skippedDuplicateCount: duplicateRecipients.length,
          skippedBlockedCount: blockedRecipients.length,
          recipients: {
            create: [
              ...duplicateRecipients.map((recipient) => ({
                countryCode: recipient.countryCode,
                phoneNumber: recipient.phoneNumber,
                name: recipient.name,
                bodyParameters: recipient.bodyParameters.length
                  ? recipient.bodyParameters
                  : input.bodyParameters,
                status: "SKIPPED_DUPLICATE" as const,
              })),
              ...blockedRecipients.map((recipient) => ({
                countryCode: recipient.countryCode,
                phoneNumber: recipient.phoneNumber,
                name: recipient.name,
                bodyParameters: recipient.bodyParameters.length
                  ? recipient.bodyParameters
                  : input.bodyParameters,
                status: "SKIPPED_BLOCKED" as const,
                errorMessage: "Contact is blocked",
              })),
            ],
          },
        },
      });
      const messages = [];

      for (const recipient of uniqueRecipients) {
        const recipientParameters = recipient.bodyParameters.length
          ? recipient.bodyParameters
          : input.bodyParameters;
        const contact = await tx.contact.upsert({
          where: {
            companyId_phoneNumber: {
              companyId,
              phoneNumber: recipient.phoneNumber,
            },
          },
          update: {
            countryCode: recipient.countryCode,
            ...(recipient.name ? { name: recipient.name } : {}),
          },
          create: {
            companyId,
            name: recipient.name,
            countryCode: recipient.countryCode,
            phoneNumber: recipient.phoneNumber,
          },
        });
        const message = await tx.message.create({
          data: {
            companyId,
            contactId: contact.id,
            templateId: template.id,
            direction: "OUTBOUND",
            status: "QUEUED",
            toPhoneNumber: `${recipient.countryCode}${recipient.phoneNumber}`,
            body: renderTemplateBody(template.body, recipientParameters),
            variables: recipientParameters,
            events: {
              create: {
                companyId,
                status: "QUEUED",
                raw: {
                  source: "bulk_message",
                  reason: "Bulk template message queued",
                },
              },
            },
          },
        });

        await tx.bulkMessageBatchRecipient.create({
          data: {
            batchId: batch.id,
            messageId: message.id,
            queueJobId: message.id,
            countryCode: recipient.countryCode,
            phoneNumber: recipient.phoneNumber,
            name: recipient.name,
            bodyParameters: recipientParameters,
            status: isScheduled ? "SCHEDULED" : "QUEUED",
          },
        });

        messages.push({
          messageId: message.id,
          contactId: contact.id,
          phoneNumber: recipient.phoneNumber,
        });
      }

      await tx.walletTransaction.create({
        data: {
          companyId,
          type: "DEBIT",
          status: "SUCCESS",
          amountPaise: totalChargePaise,
          description: `${messages.length} bulk template message(s) queued`,
          referenceId: batch.id,
        },
      });

      return { batch, messages };
    },
    { timeout: 20_000 },
  );

  const queuedMessages = transactionResult.messages;

  try {
    await getMessageQueue().addBulk(
      queuedMessages.map((message) => ({
        name: "send-template-message",
        data: { messageId: message.messageId, companyId },
        opts: {
          jobId: message.messageId,
          ...(delay > 0 ? { delay } : {}),
        },
      })),
    );
  } catch {
    const messageIds = queuedMessages.map((message) => message.messageId);

    await prisma.$transaction([
      prisma.message.updateMany({
        where: { id: { in: messageIds }, companyId },
        data: { status: "FAILED" },
      }),
      prisma.messageEvent.createMany({
        data: messageIds.map((messageId) => ({
          companyId,
          messageId,
          status: "FAILED",
          raw: {
            source: "bulk_message",
            reason: "Unable to enqueue bulk message",
          },
        })),
      }),
      prisma.bulkMessageBatchRecipient.updateMany({
        where: {
          batchId: transactionResult.batch.id,
          status: { in: ["QUEUED", "SCHEDULED"] },
        },
        data: {
          status: "FAILED",
          errorMessage: "Unable to enqueue bulk message",
        },
      }),
      prisma.bulkMessageBatch.update({
        where: { id: transactionResult.batch.id },
        data: {
          status: "FAILED",
          queuedCount: 0,
          failedCount: queuedMessages.length,
        },
      }),
      prisma.wallet.update({
        where: { companyId },
        data: { balancePaise: { increment: totalChargePaise } },
      }),
      prisma.walletTransaction.create({
        data: {
          companyId,
          type: "REFUND",
          status: "SUCCESS",
          amountPaise: totalChargePaise,
          description: "Bulk message enqueue failure refund",
        },
      }),
    ]);

    throw new Error("Unable to enqueue bulk messages");
  }

  return {
    batch: transactionResult.batch,
    template,
    contactGroup,
    requestedCount,
    queuedCount: queuedMessages.length,
    failedCount: 0,
    skippedDuplicateCount: duplicateRecipients.length,
    skippedBlockedCount: blockedRecipients.length,
    queuedMessages,
  };
}
