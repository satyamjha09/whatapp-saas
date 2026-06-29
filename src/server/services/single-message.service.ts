import { getMessageQueue } from "@/lib/queue";
import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { uploadWhatsAppMedia } from "@/lib/whatsapp";
import { assertContactCanReceiveTemplate } from "@/server/services/contact-consent.service";
import { assertCompanyMessageQuota } from "@/server/services/message-quota.service";
import { assertSubscriptionCanSend } from "@/server/services/subscription-expiry.service";
import { getWhatsAppAccessToken } from "@/server/services/whatsapp-secret.service";
import {
  assertUsageQuotaAvailable,
  incrementUsageQuota,
} from "@/server/services/usage-quota.service";
import type { SendSingleTemplateMessageInput } from "@/server/validators/single-message.validator";

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "");
}

function renderTemplateBody(body: string, parameters: string[]) {
  return body.replace(/{{(\d+)}}/g, (_, index: string) => {
    return parameters[Number(index) - 1] ?? `{{${index}}}`;
  });
}

export async function uploadSingleMessageMedia(
  companyId: string,
  file: File,
) {
  const whatsAppAccount = await prisma.whatsAppAccount.findFirst({
    where: {
      companyId,
      status: "CONNECTED",
      accessToken: { not: null },
      phoneNumbers: {
        some: { phoneNumberId: { not: null } },
      },
    },
    include: {
      phoneNumbers: {
        where: {
          phoneNumberId: {
            not: null,
          },
        },
        take: 1,
      },
    },
  });

  const phoneNumber = whatsAppAccount?.phoneNumbers[0];

  if (!whatsAppAccount || !phoneNumber?.phoneNumberId) {
    throw new Error("WhatsApp account is not connected");
  }

  const accessToken = await getWhatsAppAccessToken({ companyId });

  return uploadWhatsAppMedia({
    accessToken,
    phoneNumberId: phoneNumber.phoneNumberId,
    file,
  });
}

export async function sendSingleTemplateMessage(
  companyId: string,
  input: SendSingleTemplateMessageInput,
) {
  await assertSubscriptionCanSend(companyId);
  await assertCompanyMessageQuota(companyId);
  await assertUsageQuotaAvailable({
    companyId,
    featureKey: "BULK_MESSAGING",
    amount: 1,
  });

  const phoneNumber = normalizePhoneNumber(input.phoneNumber);
  const countryCode = normalizePhoneNumber(input.countryCode);

  const [template, whatsAppAccount] = await Promise.all([
    input.messageType === "Template"
      ? prisma.template.findFirst({
          where: {
            id: input.templateId,
            companyId,
            status: "APPROVED",
          },
        })
      : Promise.resolve(null),
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

  if (input.messageType === "Template" && !template) {
    throw new Error("Approved template not found");
  }

  if (!whatsAppAccount) throw new Error("WhatsApp account is not connected");

  if (
    input.messageType === "Template" &&
    template &&
    input.bodyParameters.length !== template.variables.length
  ) {
    throw new Error(
      `This template requires ${template.variables.length} parameter value(s)`,
    );
  }

  const contact = await prisma.contact.upsert({
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

  if (input.messageType === "Template" && template) {
    await assertContactCanReceiveTemplate({
      companyId,
      contactId: contact.id,
      templateCategory: template.category,
    });
  }

  const body =
    input.messageType === "Template" && template
      ? renderTemplateBody(template.body, input.bodyParameters)
      : input.messageType === "Text"
        ? input.text?.body.trim() ?? ""
      : input.messageType === "Media"
        ? input.media?.caption?.trim() ||
          `[${input.media?.type.toLowerCase() ?? "media"}] ${
            input.media?.name ?? input.media?.url ?? ""
          }`.trim()
        : input.messageType === "Location" && input.location
          ? `${input.location.name}\n${input.location.address}`
        : input.messageType === "Interactive" && input.interactive
          ? input.interactive.body ||
            `[interactive] ${input.interactive.type}`.trim()
        : "";

  const metadata =
    input.messageType === "Media" && input.media
      ? ({
          messageType: "MEDIA",
          mediaType: input.media.type,
          mediaUrl: input.media.url ?? null,
          mediaId: input.media.id ?? null,
          mediaName: input.media.name ?? null,
          caption: input.media.caption ?? null,
        } satisfies Prisma.InputJsonObject)
      : input.messageType === "Location" && input.location
        ? ({
            messageType: "LOCATION",
            name: input.location.name,
            address: input.location.address,
            latitude: input.location.latitude,
            longitude: input.location.longitude,
          } satisfies Prisma.InputJsonObject)
        : input.messageType === "Interactive" && input.interactive
          ? ({
              messageType: "INTERACTIVE",
              type: input.interactive.type,
              header: input.interactive.header ?? null,
              body: input.interactive.body,
              footer: input.interactive.footer ?? null,
              primaryButton: input.interactive.primaryButton ?? null,
              buttons: input.interactive.buttons ?? [],
              ctaUrl: input.interactive.ctaUrl ?? null,
              flowId: input.interactive.flowId ?? null,
              flowAction: input.interactive.flowAction ?? null,
              flowScreen: input.interactive.flowScreen ?? null,
              sections:
                input.interactive.sections?.map((section) => ({
                  title: section.title,
                  rows: section.rows.map((row) => ({
                    title: row.title,
                    description: row.description ?? null,
                  })),
                })) ?? [],
            } satisfies Prisma.InputJsonObject)
          : undefined;

  const queuedReason =
    input.messageType === "Media"
      ? "Single media message queued"
      : input.messageType === "Text"
        ? "Single text message queued"
      : input.messageType === "Location"
        ? "Single location message queued"
      : input.messageType === "Interactive"
        ? "Single interactive message queued"
        : "Single template message queued";

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

    const message = await tx.message.create({
      data: {
        companyId,
        contactId: contact.id,
        templateId: template?.id,
        direction: "OUTBOUND",
        status: "QUEUED",
        toPhoneNumber: `${countryCode}${phoneNumber}`,
        body,
        variables:
          input.messageType === "Template" ? input.bodyParameters : [],
        metadata,
        events: {
          create: {
            companyId,
            status: "QUEUED",
            raw: {
              source: "single_message",
              reason: queuedReason,
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
        description:
          input.messageType === "Media"
            ? "Single media message queued"
            : input.messageType === "Text"
              ? "Single text message queued"
            : input.messageType === "Location"
              ? "Single location message queued"
              : input.messageType === "Interactive"
                ? "Single interactive message queued"
                : "Single template message queued",
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

    await incrementUsageQuota({
      companyId,
      featureKey: "BULK_MESSAGING",
      amount: 1,
      idempotencyKey: `message-created:${result.message.id}`,
      reason: "message-created",
      metadata: {
        messageId: result.message.id,
        contactId: result.message.contactId,
      },
    });
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
