import crypto from "crypto";
import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { getMessageQueue } from "@/lib/queue";
import { Prisma } from "@/generated/prisma/client";
import type {
  CreateWhatsAppFlowInput,
  SendTestWhatsAppFlowInput,
  UpdateWhatsAppFlowInput,
} from "@/server/validators/whatsapp-flow.validator";

function safeJson(value: unknown): Prisma.InputJsonValue {
  return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;
}

function parseOutboundFlowMetadata(metadata: Prisma.JsonValue | null) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;

  if (
    record.messageType !== "INTERACTIVE" ||
    record.type !== "Flow" ||
    typeof record.flowToken !== "string" ||
    typeof record.internalFlowId !== "string"
  ) {
    return null;
  }

  return {
    campaignId:
      typeof record.campaignId === "string" ? record.campaignId : null,
    flowToken: record.flowToken,
    internalFlowId: record.internalFlowId,
  };
}

export async function getWhatsAppFlowsByCompany(companyId: string) {
  return prisma.whatsAppFlow.findMany({
    where: {
      companyId,
    },
    include: {
      _count: {
        select: {
          responses: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
}

export async function getWhatsAppFlowById({
  companyId,
  flowId,
}: {
  companyId: string;
  flowId: string;
}) {
  return prisma.whatsAppFlow.findFirst({
    where: {
      companyId,
      id: flowId,
    },
    include: {
      responses: {
        include: {
          contact: {
            select: {
              countryCode: true,
              id: true,
              name: true,
              phoneNumber: true,
            },
          },
          message: {
            select: {
              body: true,
              createdAt: true,
              id: true,
            },
          },
        },
        orderBy: {
          submittedAt: "desc",
        },
        take: 100,
      },
    },
  });
}

export async function createWhatsAppFlow({
  companyId,
  input,
}: {
  companyId: string;
  input: CreateWhatsAppFlowInput;
}) {
  return prisma.whatsAppFlow.create({
    data: {
      companyId,
      dataApiEndpoint: input.dataApiEndpoint?.trim() || null,
      defaultCta: input.defaultCta,
      defaultScreen: input.defaultScreen?.trim() || null,
      description: input.description?.trim() || null,
      metaFlowId: input.metaFlowId,
      name: input.name,
      schema: safeJson(input.schema),
      status: input.status,
      useCase: input.useCase,
    },
  });
}

export async function updateWhatsAppFlow({
  companyId,
  flowId,
  input,
}: {
  companyId: string;
  flowId: string;
  input: UpdateWhatsAppFlowInput;
}) {
  const existing = await prisma.whatsAppFlow.findFirst({
    where: {
      companyId,
      id: flowId,
    },
  });

  if (!existing) {
    throw new Error("Flow not found");
  }

  return prisma.whatsAppFlow.update({
    where: {
      id: existing.id,
    },
    data: {
      dataApiEndpoint:
        input.dataApiEndpoint === undefined
          ? undefined
          : input.dataApiEndpoint?.trim() || null,
      defaultCta: input.defaultCta,
      defaultScreen:
        input.defaultScreen === undefined
          ? undefined
          : input.defaultScreen?.trim() || null,
      description:
        input.description === undefined
          ? undefined
          : input.description?.trim() || null,
      metaFlowId: input.metaFlowId,
      name: input.name,
      schema:
        input.schema === undefined ? undefined : safeJson(input.schema),
      status: input.status,
      useCase: input.useCase,
    },
  });
}

export async function createFlowSendMetadata({
  campaignId,
  companyId,
  contactId,
  flowId,
  flowData,
  messageId,
}: {
  campaignId?: string | null;
  companyId: string;
  contactId?: string | null;
  flowData?: Prisma.InputJsonObject | null;
  flowId: string;
  messageId?: string | null;
}) {
  const flow = await prisma.whatsAppFlow.findFirst({
    where: {
      companyId,
      id: flowId,
      status: "PUBLISHED",
    },
  });

  if (!flow) {
    throw new Error("Flow not found or not published");
  }

  const flowToken = crypto.randomUUID();

  return {
    body: flow.description ?? flow.name,
    campaignId: campaignId ?? null,
    contactId: contactId ?? null,
    flowAction: "navigate",
    flowData: flowData ?? null,
    flowId: flow.metaFlowId,
    flowScreen: flow.defaultScreen,
    flowToken,
    internalFlowId: flow.id,
    messageId: messageId ?? null,
    messageType: "INTERACTIVE",
    primaryButton: flow.defaultCta,
    type: "Flow",
  } satisfies Prisma.InputJsonObject;
}

export async function sendTestWhatsAppFlow({
  companyId,
  flowId,
  input,
}: {
  companyId: string;
  flowId: string;
  input: SendTestWhatsAppFlowInput;
}) {
  const countryCode = input.countryCode.replace(/^\+/, "");
  const phoneNumber = input.phoneNumber.replace(/\D/g, "");
  const contact = await prisma.contact.upsert({
    where: {
      companyId_phoneNumber: {
        companyId,
        phoneNumber,
      },
    },
    create: {
      companyId,
      countryCode,
      name: "Flow test recipient",
      phoneNumber,
    },
    update: {
      countryCode,
    },
  });

  const metadata = await createFlowSendMetadata({
    companyId,
    contactId: contact.id,
    flowId,
  });

  const result = await prisma.$transaction(async (tx) => {
    const debitResult = await tx.wallet.updateMany({
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

    if (debitResult.count !== 1) {
      throw new Error("Insufficient wallet balance");
    }

    const message = await tx.message.create({
      data: {
        body: String(metadata.body ?? "WhatsApp Flow"),
        companyId,
        contactId: contact.id,
        direction: "OUTBOUND",
        events: {
          create: {
            companyId,
            raw: {
              flowId,
              source: "whatsapp_flow_test",
            },
            status: "QUEUED",
          },
        },
        metadata,
        status: "QUEUED",
        toPhoneNumber: `${countryCode}${phoneNumber}`,
        variables: [],
      },
    });

    const walletTransaction = await tx.walletTransaction.create({
      data: {
        amountPaise: MESSAGE_PRICE_PAISE,
        companyId,
        description: "WhatsApp Flow test message queued",
        referenceId: message.id,
        referenceType: "MESSAGE_USAGE",
        status: "SUCCESS",
        type: "DEBIT",
      },
    });

    await tx.messageUsageLedger.create({
      data: {
        amountPaise: MESSAGE_PRICE_PAISE,
        companyId,
        messageId: message.id,
        status: "CHARGED",
        walletTransactionId: walletTransaction.id,
      },
    });

    return {
      contact,
      message,
    };
  });

  await getMessageQueue().add("send-template-message", {
    companyId,
    messageId: result.message.id,
  });

  return result;
}

export async function recordWhatsAppFlowResponse({
  companyId,
  contactId,
  flowToken,
  inboundMessageId,
  rawWebhook,
  responsePayload,
}: {
  companyId: string;
  contactId?: string | null;
  flowToken: string;
  inboundMessageId?: string | null;
  rawWebhook?: unknown;
  responsePayload: unknown;
}) {
  const outbound = await prisma.message.findFirst({
    where: {
      companyId,
      direction: "OUTBOUND",
      metadata: {
        path: ["flowToken"],
        equals: flowToken,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      campaignId: true,
      contactId: true,
      id: true,
      metadata: true,
    },
  });
  const metadata = parseOutboundFlowMetadata(outbound?.metadata ?? null);

  if (!metadata) {
    throw new Error("Flow token could not be matched to an outbound Flow");
  }

  return prisma.whatsAppFlowResponse.upsert({
    where: {
      flowToken,
    },
    create: {
      campaignId: outbound?.campaignId ?? metadata.campaignId,
      companyId,
      contactId: contactId ?? outbound?.contactId ?? null,
      flowId: metadata.internalFlowId,
      flowToken,
      messageId: inboundMessageId ?? outbound?.id ?? null,
      rawWebhook: safeJson(rawWebhook),
      responsePayload: safeJson(responsePayload),
    },
    update: {
      campaignId: outbound?.campaignId ?? metadata.campaignId,
      contactId: contactId ?? outbound?.contactId ?? null,
      messageId: inboundMessageId ?? outbound?.id ?? null,
      rawWebhook: safeJson(rawWebhook),
      responsePayload: safeJson(responsePayload),
      submittedAt: new Date(),
    },
  });
}
