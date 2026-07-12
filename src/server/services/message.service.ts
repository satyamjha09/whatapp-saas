import crypto from "node:crypto";
import { getMessageQueue } from "@/lib/queue";
import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
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
import {
  createWhatsAppFlowToken,
  encryptWhatsAppFlowToken,
  hashWhatsAppFlowToken,
  isFlowUsableForTemplate,
  readFlowTemplateRuntimeConfig,
} from "@/server/services/whatsapp-flow.service";
import { readFlowResponseMappingsFromComponents } from "@/lib/whatsapp-flow-response-mapping";
import { buildCatalogTemplateSendMetadata } from "@/server/services/whatsapp-catalog-runtime.service";

type AutomationFlowTemplateContext = {
  conversionGoalNodeId?: string | null;
  executionId: string;
  nodeId: string;
  sessionId: string;
  stepId?: string | null;
};

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
  input: SendTemplateMessageInput & {
    automationContext?: AutomationFlowTemplateContext;
  },
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
  const flowConfig = readFlowTemplateRuntimeConfig(template.components);
  const catalogMetadata = await buildCatalogTemplateSendMetadata({
    companyId,
    template,
  });

  if (flowConfig) {
    const idempotencyKey = `flow-template:${
      input.idempotencyKey ?? crypto.randomUUID()
    }`;

    const existingInteraction =
      await prisma.whatsAppFlowInteraction.findUnique({
        where: {
          companyId_idempotencyKey: {
            companyId,
            idempotencyKey,
          },
        },
        include: {
          message: {
            include: {
              contact: true,
              events: true,
              template: true,
            },
          },
        },
      });

    if (existingInteraction?.message) {
      if (
        ["QUEUED", "RETRY_PENDING"].includes(
          existingInteraction.message.status,
        )
      ) {
        await enqueueTemplateMessage(existingInteraction.message.id, companyId);
      }

      return existingInteraction.message;
    }

    const flowAsset = await prisma.whatsAppFlow.findFirst({
      where: {
        companyId,
        id: flowConfig.localFlowId,
      },
      select: {
        id: true,
        isUsableForTemplates: true,
        metaFlowId: true,
        remoteMissingAt: true,
        remoteStatus: true,
        status: true,
      },
    });

    if (!flowAsset || !isFlowUsableForTemplate(flowAsset)) {
      throw new Error("Flow not found or not published");
    }

    const flowToken = createWhatsAppFlowToken();
    const flowTokenEncrypted = encryptWhatsAppFlowToken(flowToken);
    const flowTokenHash = hashWhatsAppFlowToken(flowToken);
    const responseMappingSnapshot =
      readFlowResponseMappingsFromComponents(template.components);

    const message = await prisma
      .$transaction(async (tx) => {
        const interaction = await tx.whatsAppFlowInteraction.create({
          data: {
            automationExecutionId: input.automationContext?.executionId ?? null,
            automationNodeId: input.automationContext?.nodeId ?? null,
            automationStepId: input.automationContext?.stepId ?? null,
            conversionGoalNodeId:
              input.automationContext?.conversionGoalNodeId ?? null,
            companyId,
            contactId: contact.id,
            flowAssetId: flowAsset.id,
            flowTokenEncrypted,
            flowTokenHash,
            idempotencyKey,
            metaFlowId: flowConfig.metaFlowId || flowAsset.metaFlowId,
            responseMappingSnapshot:
              responseMappingSnapshot.length > 0
                ? (responseMappingSnapshot as Prisma.InputJsonValue)
                : undefined,
            status: "PENDING",
            templateId: template.id,
          },
        });

        await tx.wallet.upsert({
          where: {
            companyId,
          },
          update: {},
          create: {
            companyId,
            balancePaise: 0,
          },
        });

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
            body,
            companyId,
            contactId: contact.id,
            direction: "OUTBOUND",
            events: {
              create: {
                companyId,
                raw: {
                  automationExecutionId: input.automationContext?.executionId,
                  automationNodeId: input.automationContext?.nodeId,
                  automationSessionId: input.automationContext?.sessionId,
                  flowInteractionId: interaction.id,
                  localFlowId: flowAsset.id,
                  metaFlowId: flowConfig.metaFlowId || flowAsset.metaFlowId,
                  reason: "Flow template message queued",
                  source: input.automationContext
                    ? "automation_runtime"
                    : "api",
                },
                status: "QUEUED",
              },
            },
            idempotencyKey,
            metadata: {
              ...(input.automationContext
                ? {
                    automationExecutionId:
                      input.automationContext.executionId,
                    automationNodeId: input.automationContext.nodeId,
                    automationSessionId: input.automationContext.sessionId,
                    source: "automation_runtime",
                  }
                : {}),
              flowAction: flowConfig.action,
              flowInteractionId: interaction.id,
              flowScreen: flowConfig.navigateScreen,
              internalFlowId: flowAsset.id,
              messageType: "FLOW_TEMPLATE",
              metaFlowId: flowConfig.metaFlowId || flowAsset.metaFlowId,
              primaryButton: flowConfig.buttonText,
            },
            status: "QUEUED",
            templateId: template.id,
            toPhoneNumber,
            variables: input.variables,
          },
          include: {
            contact: true,
            events: true,
            template: true,
          },
        });

        const walletTransaction = await tx.walletTransaction.create({
          data: {
            amountPaise: MESSAGE_PRICE_PAISE,
            companyId,
            description: "Flow template message queued",
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

        await tx.whatsAppFlowInteraction.update({
          where: {
            id: interaction.id,
          },
          data: {
            messageId: createdMessage.id,
            status: "QUEUED",
          },
        });

        return createdMessage;
      })
      .catch(async (error) => {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }

        const interaction = await prisma.whatsAppFlowInteraction.findUnique({
          where: {
            companyId_idempotencyKey: {
              companyId,
              idempotencyKey,
            },
          },
          include: {
            message: {
              include: {
                contact: true,
                events: true,
                template: true,
              },
            },
          },
        });

        if (interaction?.message) return interaction.message;

        throw error;
      });

    try {
      await enqueueTemplateMessage(message.id, companyId);
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Unable to queue message";

      await markFlowTemplateQueueFailure({
        companyId,
        messageId: message.id,
        reason,
      });

      throw error;
    }

    return message;
  }

  const message = await prisma.$transaction(async (tx) => {
    await tx.wallet.upsert({
      where: {
        companyId,
      },
      update: {},
      create: {
        companyId,
        balancePaise: 0,
      },
    });

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
        idempotencyKey: input.idempotencyKey,
        metadata:
          catalogMetadata || input.automationContext
            ? {
                ...(input.automationContext
                  ? {
                      automationExecutionId:
                        input.automationContext.executionId,
                      automationNodeId: input.automationContext.nodeId,
                      automationSessionId: input.automationContext.sessionId,
                      source: "automation_runtime",
                    }
                  : {}),
                ...(catalogMetadata ?? {}),
              }
            : undefined,
        events: {
          create: {
            companyId,
            status: "QUEUED",
            raw: {
              source: input.automationContext ? "automation_runtime" : "api",
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

  await enqueueTemplateMessage(message.id, companyId);

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

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

async function enqueueTemplateMessage(messageId: string, companyId: string) {
  await getMessageQueue().add(
    "send-template-message",
    {
      messageId,
      companyId,
    },
    {
      jobId: messageId,
    },
  );
}

async function markFlowTemplateQueueFailure({
  companyId,
  messageId,
  reason,
}: {
  companyId: string;
  messageId: string;
  reason: string;
}) {
  await prisma.$transaction([
    prisma.message.updateMany({
      where: {
        companyId,
        id: messageId,
        status: "QUEUED",
      },
      data: {
        errorMessage: reason,
        status: "RETRY_PENDING",
      },
    }),
    prisma.messageEvent.create({
      data: {
        companyId,
        messageId,
        raw: {
          reason,
          source: "flow_template_queue",
        },
        status: "RETRY_PENDING",
      },
    }),
    prisma.whatsAppFlowInteraction.updateMany({
      where: {
        companyId,
        messageId,
      },
      data: {
        lastError: reason,
        status: "QUEUED",
      },
    }),
  ]);
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

  const message = await prisma.$transaction(async (tx) => {
    await tx.wallet.upsert({
      where: {
        companyId,
      },
      update: {},
      create: {
        companyId,
        balancePaise: 0,
      },
    });

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

    const walletTransaction = await tx.walletTransaction.create({
      data: {
        companyId,
        type: "DEBIT",
        status: "SUCCESS",
        amountPaise: MESSAGE_PRICE_PAISE,
        description: "Inbox reply queued",
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

  await getMessageQueue().add("send-session-message", {
    messageId: message.id,
    companyId,
  }, {
    jobId: message.id,
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
