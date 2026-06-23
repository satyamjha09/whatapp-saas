import { getMessageQueue } from "@/lib/queue";
import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { assertCompanyMessageQuota } from "@/server/services/message-quota.service";
import { assertSubscriptionCanSend } from "@/server/services/subscription-expiry.service";
import type { SendSingleTemplateMessageInput } from "@/server/validators/single-message.validator";

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "");
}

function renderTemplateBody(body: string, parameters: string[]) {
  return body.replace(/{{(\d+)}}/g, (_, index: string) => {
    return parameters[Number(index) - 1] ?? `{{${index}}}`;
  });
}

export async function sendSingleTemplateMessage(
  companyId: string,
  input: SendSingleTemplateMessageInput,
) {
  await assertSubscriptionCanSend(companyId);
  await assertCompanyMessageQuota(companyId);
  const phoneNumber = normalizePhoneNumber(input.phoneNumber);
  const countryCode = normalizePhoneNumber(input.countryCode);

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
    throw new Error(
      `This template requires ${template.variables.length} parameter value(s)`,
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const debitResult = await tx.wallet.updateMany({
      where: {
        companyId,
        balancePaise: { gte: MESSAGE_PRICE_PAISE },
      },
      data: {
        balancePaise: { decrement: MESSAGE_PRICE_PAISE },
      },
    });

    if (debitResult.count !== 1) {
      throw new Error("Insufficient wallet balance");
    }

    const contact = await tx.contact.upsert({
      where: {
        companyId_phoneNumber: { companyId, phoneNumber },
      },
      update: {
        countryCode,
        ...(input.name ? { name: input.name } : {}),
      },
      create: {
        companyId,
        name: input.name || null,
        countryCode,
        phoneNumber,
      },
    });

    const message = await tx.message.create({
      data: {
        companyId,
        contactId: contact.id,
        templateId: template.id,
        direction: "OUTBOUND",
        status: "QUEUED",
        toPhoneNumber: `${countryCode}${phoneNumber}`,
        body: renderTemplateBody(template.body, input.bodyParameters),
        variables: input.bodyParameters,
        events: {
          create: {
            companyId,
            status: "QUEUED",
            raw: {
              source: "single_message",
              reason: "Single template message queued",
            },
          },
        },
      },
    });

    const walletTransaction = await tx.walletTransaction.create({
      data: {
        companyId,
        type: "DEBIT",
        status: "SUCCESS",
        amountPaise: MESSAGE_PRICE_PAISE,
        description: "Single template message queued",
        referenceType: "MESSAGE_USAGE",
        referenceId: message.id,
      },
    });

    await tx.messageUsageLedger.create({
      data: {
        companyId,
        messageId: message.id,
        walletTransactionId: walletTransaction.id,
        status: "CHARGED",
        amountPaise: MESSAGE_PRICE_PAISE,
      },
    });

    return { contact, message };
  });

  try {
    await getMessageQueue().add(
      "send-template-message",
      {
        messageId: result.message.id,
        companyId,
      },
      { jobId: result.message.id },
    );
  } catch {
    await prisma.$transaction([
      prisma.message.update({
        where: { id: result.message.id },
        data: {
          status: "FAILED",
          events: {
            create: {
              companyId,
              status: "FAILED",
              raw: {
                source: "single_message",
                reason: "Unable to enqueue message",
              },
            },
          },
        },
      }),
      prisma.wallet.update({
        where: { companyId },
        data: { balancePaise: { increment: MESSAGE_PRICE_PAISE } },
      }),
      prisma.walletTransaction.create({
        data: {
          companyId,
          type: "REFUND",
          status: "SUCCESS",
          amountPaise: MESSAGE_PRICE_PAISE,
          description: "Single message enqueue failure refund",
          referenceId: result.message.id,
        },
      }),
    ]);

    throw new Error("Unable to enqueue message");
  }

  return {
    message: result.message,
    contact: result.contact,
    template,
  };
}
