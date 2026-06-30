import { getMessageQueue } from "@/lib/queue";
import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { assertContactCanReceiveTemplate } from "@/server/services/contact-consent.service";
import { recordContactActivity } from "@/server/services/contact-activity.service";
import { assertCompanyMessageQuota } from "@/server/services/message-quota.service";
import { assertSubscriptionCanSend } from "@/server/services/subscription-expiry.service";
import {
  assertUsageQuotaAvailable,
  incrementUsageQuota,
} from "@/server/services/usage-quota.service";
import { SendTemplateMessageInput } from "@/server/validators/message.validator";
import { PublicSendTemplateMessageInput } from "@/server/validators/public-message.validator";
import { CreateInboxReplyInput } from "@/server/validators/inbox-reply.validator";

function renderTemplateBody(body: string, variables: string[]) {
  return body.replace(/{{(\d+)}}/g, (_, index: string) => {
    const value = variables[Number(index) - 1];

    return value ?? `{{${index}}}`;
  });
}

export async function getMessagesByCompany(companyId: string) {
  return prisma.message.findMany({
    where: {
      companyId,
    },
    include: {
      contact: true,
      template: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function createQueuedTemplateMessage(
  companyId: string,
  input: SendTemplateMessageInput,
) {
  await assertSubscriptionCanSend(companyId);
  await assertCompanyMessageQuota(companyId);
  await assertUsageQuotaAvailable({
    companyId,
    featureKey: "BULK_MESSAGING",
    amount: 1,
  });

  const contact = await prisma.contact.findFirst({
    where: {
      id: input.contactId,
      companyId,
    },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  const template = await prisma.template.findFirst({
    where: {
      id: input.templateId,
      companyId,
      status: "APPROVED",
    },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  const requiredVariableCount = template.variables.length;

  if (input.variables.length !== requiredVariableCount) {
    throw new Error(
      `This template requires ${requiredVariableCount} variable value(s)`,
    );
  }

  await assertContactCanReceiveTemplate({
    companyId,
    contactId: contact.id,
    templateCategory: template.category,
  });

  const toPhoneNumber = `${contact.countryCode}${contact.phoneNumber}`;
  const body = renderTemplateBody(template.body, input.variables);

  const message = await prisma.$transaction(async (tx) => {
    const debitResult = await tx.wallet.updateMany({
      where: {
        companyId,
        balancePaise: {
          gte: MESSAGE_PRICE_PAISE,
        },
      },
      data: {
        balancePaise: {
          decrement: MESSAGE_PRICE_PAISE,
        },
      },
    });

    if (debitResult.count !== 1) {
      throw new Error("Insufficient wallet balance");
    }

    const createdMessage = await tx.message.create({
      data: {
        companyId,
        contactId: contact.id,
        templateId: template.id,
        toPhoneNumber,
        body,
        variables: input.variables,
        status: "QUEUED",
        direction: "OUTBOUND",
        events: {
          create: {
            companyId,
            status: "QUEUED",
            raw: {
              source: "api",
              reason: "Template message queued",
            },
          },
        },
      },
      include: {
        contact: true,
        template: true,
        events: true,
      },
    });

    const walletTransaction = await tx.walletTransaction.create({
      data: {
        companyId,
        type: "DEBIT",
        status: "SUCCESS",
        amountPaise: MESSAGE_PRICE_PAISE,
        description: "Template message queued",
        referenceType: "MESSAGE_USAGE",
        referenceId: createdMessage.id,
      },
    });

    await tx.messageUsageLedger.create({
      data: {
        companyId,
        messageId: createdMessage.id,
        walletTransactionId: walletTransaction.id,
        status: "CHARGED",
        amountPaise: MESSAGE_PRICE_PAISE,
      },
    });

    return createdMessage;
  });

  await getMessageQueue().add("send-template-message", {
    messageId: message.id,
    companyId,
  });

  return message;
}

export async function getMessageByCompany(messageId: string, companyId: string) {
  return prisma.message.findFirst({
    where: {
      id: messageId,
      companyId,
    },
    include: {
      contact: true,
      template: true,
      events: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}

export async function createQueuedInboxReply(
  companyId: string,
  contactId: string,
  input: CreateInboxReplyInput,
  actorUserId?: string | null,
) {
  await assertSubscriptionCanSend(companyId);
  await assertCompanyMessageQuota(companyId);
  await assertUsageQuotaAvailable({
    companyId,
    featureKey: "BULK_MESSAGING",
    amount: 1,
  });

  const contact = await prisma.contact.findFirst({
    where: {
      id: contactId,
      companyId,
    },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  const customerServiceWindowStartedAt = contact.inboxLastCustomerMessageAt;
  const customerServiceWindowEndsAt = customerServiceWindowStartedAt
    ? new Date(
        customerServiceWindowStartedAt.getTime() + 24 * 60 * 60 * 1000,
      )
    : null;

  if (!customerServiceWindowEndsAt || customerServiceWindowEndsAt <= new Date()) {
    throw new Error("Customer service window has expired");
  }

  const message = await prisma.message.create({
    data: {
      companyId,
      contactId: contact.id,
      toPhoneNumber: `${contact.countryCode}${contact.phoneNumber}`,
      body: input.body,
      variables: [],
      status: "QUEUED",
      direction: "OUTBOUND",
      events: {
        create: {
          companyId,
          status: "QUEUED",
          raw: {
            source: "inbox_reply",
            reason: "Customer service window reply queued",
          },
        },
      },
    },
    include: {
      contact: true,
      events: true,
    },
  });

  await getMessageQueue().add("send-session-message", {
    messageId: message.id,
    companyId,
  });

  await incrementUsageQuota({
    companyId,
    featureKey: "BULK_MESSAGING",
    amount: 1,
    idempotencyKey: `message-created:${message.id}`,
    reason: "message-created",
    metadata: {
      messageId: message.id,
      contactId: message.contactId,
    },
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
    actorUserId,
    type: "MESSAGE_OUTBOUND",
    title: "Team sent message",
    metadata: {
      messageId: message.id,
      status: message.status,
    },
  });

  return message;
}

function splitPhoneNumber(to: string) {
  if (to.startsWith("91") && to.length > 10) {
    return {
      countryCode: "91",
      phoneNumber: to.slice(2),
    };
  }

  return {
    countryCode: "",
    phoneNumber: to,
  };
}

export async function createQueuedPublicTemplateMessage(
  companyId: string,
  input: PublicSendTemplateMessageInput,
) {
  await assertSubscriptionCanSend(companyId);
  await assertCompanyMessageQuota(companyId);
  await assertUsageQuotaAvailable({
    companyId,
    featureKey: "BULK_MESSAGING",
    amount: 1,
  });

  const template = await prisma.template.findFirst({
    where: {
      companyId,
      name: input.templateName,
      language: input.language,
      status: "APPROVED",
    },
  });

  if (!template) {
    throw new Error("Template not found");
  }

  const requiredVariableCount = template.variables.length;

  if (input.variables.length !== requiredVariableCount) {
    throw new Error(
      `This template requires ${requiredVariableCount} variable value(s)`,
    );
  }

  const phone = splitPhoneNumber(input.to);
  const contact = await prisma.contact.upsert({
    where: {
      companyId_phoneNumber: {
        companyId,
        phoneNumber: phone.phoneNumber,
      },
    },
    update: {
      name: input.contactName,
      countryCode: phone.countryCode,
    },
    create: {
      companyId,
      name: input.contactName,
      countryCode: phone.countryCode,
      phoneNumber: phone.phoneNumber,
    },
  });

  await assertContactCanReceiveTemplate({
    companyId,
    contactId: contact.id,
    templateCategory: template.category,
  });

  const message = await prisma.$transaction(async (tx) => {
    const existingWallet = await tx.wallet.findUnique({
      where: {
        companyId,
      },
    });

    if (!existingWallet) {
      await tx.wallet.create({
        data: {
          companyId,
          balancePaise: 0,
        },
      });
    }

    const debitResult = await tx.wallet.updateMany({
      where: {
        companyId,
        balancePaise: {
          gte: MESSAGE_PRICE_PAISE,
        },
      },
      data: {
        balancePaise: {
          decrement: MESSAGE_PRICE_PAISE,
        },
      },
    });

    if (debitResult.count !== 1) {
      throw new Error("Insufficient wallet balance");
    }

    const body = renderTemplateBody(template.body, input.variables);

    const createdMessage = await tx.message.create({
      data: {
        companyId,
        contactId: contact.id,
        templateId: template.id,
        toPhoneNumber: input.to,
        body,
        variables: input.variables,
        status: "QUEUED",
        direction: "OUTBOUND",
        events: {
          create: {
            companyId,
            status: "QUEUED",
            raw: {
              source: "public_api",
              templateName: input.templateName,
              language: input.language,
            },
          },
        },
      },
      include: {
        contact: true,
        template: true,
        events: true,
      },
    });

    const walletTransaction = await tx.walletTransaction.create({
      data: {
        companyId,
        type: "DEBIT",
        status: "SUCCESS",
        amountPaise: MESSAGE_PRICE_PAISE,
        description: "Template message queued via public API",
        referenceType: "MESSAGE_USAGE",
        referenceId: createdMessage.id,
      },
    });

    await tx.messageUsageLedger.create({
      data: {
        companyId,
        messageId: createdMessage.id,
        walletTransactionId: walletTransaction.id,
        status: "CHARGED",
        amountPaise: MESSAGE_PRICE_PAISE,
      },
    });

    return createdMessage;
  });

  await getMessageQueue().add("send-template-message", {
    messageId: message.id,
    companyId,
  });

  await incrementUsageQuota({
    companyId,
    featureKey: "BULK_MESSAGING",
    amount: 1,
    idempotencyKey: `message-created:${message.id}`,
    reason: "message-created",
    metadata: {
      messageId: message.id,
      contactId: message.contactId,
    },
  });

  return message;
}
