import { getMessageQueue } from "@/lib/queue";
import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { uploadWhatsAppMedia } from "@/lib/whatsapp";
import { assertContactCanReceiveTemplate } from "@/server/services/contact-consent.service";
import { assertCompanyMessageQuota } from "@/server/services/message-quota.service";
import { assertSubscriptionCanSend } from "@/server/services/subscription-expiry.service";
import { getWhatsAppAccessToken } from "@/server/services/whatsapp-secret.service";
import { createFlowSendMetadata } from "@/server/services/whatsapp-flow.service";
import {
  assertUsageQuotaAvailable,
  incrementUsageQuota,
} from "@/server/services/usage-quota.service";
import type { SendSingleTemplateMessageInput } from "@/server/validators/single-message.validator";
import { buildCatalogTemplateSendMetadata } from "@/server/services/whatsapp-catalog-runtime.service";

function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "");
}

function renderTemplateBody(body: string, parameters: string[]) {
  return body.replace(/{{(\d+)}}/g, (_, index: string) => {
    return parameters[Number(index) - 1] ?? `{{${index}}}`;
  });
}

function readCatalogProductIds(input: SendSingleTemplateMessageInput) {
  const productIds =
    input.catalog?.selectedProductIds ??
    input.catalog?.localProductIds ??
    input.catalog?.productIds ??
    [];

  return Array.from(new Set(productIds.map((value) => value.trim()).filter(Boolean)));
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
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

export async function assertSingleMessageSendPreconditions(companyId: string) {
  await assertSubscriptionCanSend(companyId);
  await assertCompanyMessageQuota(companyId);
  await assertUsageQuotaAvailable({
    companyId,
    featureKey: "BULK_MESSAGING",
    amount: 1,
  });

  const wallet = await prisma.wallet.findUnique({
    where: { companyId },
    select: { balancePaise: true },
  });

  if (!wallet || wallet.balancePaise < MESSAGE_PRICE_PAISE) {
    throw new Error("Insufficient wallet balance");
  }
}

export async function sendSingleTemplateMessage(
  companyId: string,
  input: SendSingleTemplateMessageInput,
) {
  await assertSingleMessageSendPreconditions(companyId);

  const phoneNumber = normalizePhoneNumber(input.phoneNumber);
  const countryCode = normalizePhoneNumber(input.countryCode);
  const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  const now = new Date();
  const isScheduled = Boolean(
    scheduledAt && scheduledAt.getTime() > now.getTime(),
  );
  const delay =
    isScheduled && scheduledAt
      ? Math.max(scheduledAt.getTime() - now.getTime(), 0)
      : 0;

  if (input.scheduledAt && !isScheduled) {
    throw new Error("Schedule time must be in the future");
  }

  const idempotencyKey = input.idempotencyKey?.trim() || null;

  if (idempotencyKey) {
    const existingMessage = await prisma.message.findUnique({
      where: {
        companyId_idempotencyKey: {
          companyId,
          idempotencyKey,
        },
      },
      include: {
        contact: true,
        template: true,
      },
    });

    if (existingMessage) {
      return {
        contact: existingMessage.contact,
        message: existingMessage,
        template: existingMessage.template,
      };
    }
  }

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

  const contact = input.contactId
    ? await prisma.contact.findFirst({
        where: {
          companyId,
          id: input.contactId,
        },
      })
    : await prisma.contact.upsert({
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

  if (!contact) {
    throw new Error("Contact not found");
  }

  if (
    input.contactId &&
    (contact.phoneNumber !== phoneNumber || contact.countryCode !== countryCode)
  ) {
    throw new Error("Contact does not match recipient phone number");
  }

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

  let metadata: Prisma.InputJsonObject | undefined =
    input.messageType === "Template" && template
      ? await buildCatalogTemplateSendMetadata({
          companyId,
          selectedLocalProductIds: readCatalogProductIds(input),
          template,
        })
      : undefined;

  if (input.messageType === "Media" && input.media) {
    metadata = {
          messageType: "MEDIA",
          mediaType: input.media.type,
          mediaUrl: input.media.url ?? null,
          mediaId: input.media.id ?? null,
          mediaName: input.media.name ?? null,
          caption: input.media.caption ?? null,
    };
  } else if (input.messageType === "Location" && input.location) {
    metadata = {
      messageType: "LOCATION",
      name: input.location.name,
      address: input.location.address,
      latitude: input.location.latitude,
      longitude: input.location.longitude,
    };
  } else if (input.messageType === "Interactive" && input.interactive) {
    if (input.interactive.type === "Flow") {
      const flowMetadata = await createFlowSendMetadata({
        companyId,
        contactId: contact.id,
        flowId: input.interactive.flowId ?? "",
      });

      metadata = {
        ...flowMetadata,
        body: input.interactive.body || flowMetadata.body,
        flowAction: input.interactive.flowAction || flowMetadata.flowAction,
        flowScreen: input.interactive.flowScreen || flowMetadata.flowScreen,
        footer: input.interactive.footer ?? null,
        header: input.interactive.header ?? null,
        primaryButton:
          input.interactive.primaryButton ?? flowMetadata.primaryButton,
      };
    } else {
      metadata = {
        messageType: "INTERACTIVE",
        type: input.interactive.type,
        header: input.interactive.header ?? null,
        body: input.interactive.body,
        footer: input.interactive.footer ?? null,
        primaryButton: input.interactive.primaryButton ?? null,
        buttons: input.interactive.buttons ?? [],
        ctaUrl: input.interactive.ctaUrl ?? null,
        sections:
          input.interactive.sections?.map((section) => ({
            title: section.title,
            rows: section.rows.map((row) => ({
              title: row.title,
              description: row.description ?? null,
            })),
          })) ?? [],
      };
    }
  }

  const queuedReason =
    input.messageType === "Media"
      ? isScheduled
        ? "Single media message scheduled"
        : "Single media message queued"
      : input.messageType === "Text"
        ? isScheduled
          ? "Single text message scheduled"
          : "Single text message queued"
      : input.messageType === "Location"
        ? isScheduled
          ? "Single location message scheduled"
          : "Single location message queued"
      : input.messageType === "Interactive"
        ? isScheduled
          ? "Single interactive message scheduled"
          : "Single interactive message queued"
        : isScheduled
          ? "Single template message scheduled"
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
        idempotencyKey,
        scheduledAt: isScheduled ? scheduledAt : null,
        events: {
          create: {
            companyId,
            status: "QUEUED",
            raw: {
              source: "single_message",
              reason: queuedReason,
              scheduledAt: isScheduled ? scheduledAt?.toISOString() : null,
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
            ? isScheduled
              ? "Single media message scheduled"
              : "Single media message queued"
            : input.messageType === "Text"
              ? isScheduled
                ? "Single text message scheduled"
                : "Single text message queued"
            : input.messageType === "Location"
              ? isScheduled
                ? "Single location message scheduled"
                : "Single location message queued"
              : input.messageType === "Interactive"
                ? isScheduled
                  ? "Single interactive message scheduled"
                  : "Single interactive message queued"
                : isScheduled
                  ? "Single template message scheduled"
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

    return { alreadyQueued: false, contact, message };
  }).catch(async (error) => {
    if (!idempotencyKey || !isUniqueConstraintError(error)) {
      throw error;
    }

    const existingMessage = await prisma.message.findUnique({
      where: {
        companyId_idempotencyKey: {
          companyId,
          idempotencyKey,
        },
      },
      include: {
        contact: true,
      },
    });

    if (!existingMessage) throw error;

    return {
      alreadyQueued: true,
      contact: existingMessage.contact,
      message: existingMessage,
    };
  });

  try {
    if (result.alreadyQueued) {
      return {
        message: result.message,
        contact: result.contact,
        template,
      };
    }

    await getMessageQueue().add(
      "send-template-message",
      {
        messageId: result.message.id,
        companyId,
      },
      {
        jobId: result.message.id,
        ...(delay > 0 ? { delay } : {}),
      },
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
