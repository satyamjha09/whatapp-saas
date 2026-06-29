import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { getMessageQueue } from "@/lib/queue";
import type { Prisma } from "@/generated/prisma/client";
import type { CreateCampaignSequenceStepInput } from "@/server/validators/campaign.validator";

const DEFAULT_BATCH_SIZE = 100;

export async function getCampaignSequenceSteps({
  campaignId,
  companyId,
}: {
  campaignId: string;
  companyId: string;
}) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      companyId,
      id: campaignId,
    },
    select: {
      id: true,
    },
  });

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  return prisma.campaignSequenceStep.findMany({
    where: {
      campaignId,
      companyId,
    },
    include: {
      template: {
        select: {
          body: true,
          category: true,
          id: true,
          language: true,
          name: true,
          status: true,
          variables: true,
        },
      },
      _count: {
        select: {
          executions: true,
        },
      },
    },
    orderBy: {
      order: "asc",
    },
  });
}

export async function createCampaignSequenceStep({
  campaignId,
  companyId,
  input,
}: {
  campaignId: string;
  companyId: string;
  input: CreateCampaignSequenceStepInput;
}) {
  const [campaign, template] = await Promise.all([
    prisma.campaign.findFirst({
      where: {
        companyId,
        id: campaignId,
      },
      select: {
        id: true,
      },
    }),
    prisma.template.findFirst({
      where: {
        companyId,
        id: input.templateId,
        status: "APPROVED",
      },
      select: {
        id: true,
        variables: true,
      },
    }),
  ]);

  if (!campaign) {
    throw new Error("Campaign not found");
  }

  if (!template) {
    throw new Error("Approved template not found");
  }

  if (
    input.variables.length > 0 &&
    input.variables.length !== template.variables.length
  ) {
    throw new Error(
      `This template requires ${template.variables.length} variable value(s)`,
    );
  }

  return prisma.campaignSequenceStep.create({
    data: {
      campaignId,
      companyId,
      condition: input.condition,
      delayMinutes: input.delayMinutes,
      isActive: input.isActive,
      order: input.order,
      templateId: input.templateId,
      variables: input.variables,
    },
    include: {
      template: {
        select: {
          body: true,
          category: true,
          id: true,
          language: true,
          name: true,
          status: true,
          variables: true,
        },
      },
    },
  });
}

type PreviousMessageContext = {
  campaignContactId?: string | null;
  contact: {
    countryCode: string;
    id: string;
    isBlocked: boolean;
    optedOutAt: Date | null;
    phoneNumber: string;
  };
  contactId: string;
  message: {
    createdAt: Date;
    id: string;
    metadata: Prisma.JsonValue | null;
    status: string;
    updatedAt: Date;
    variables: string[];
  };
  variables: string[];
};

function renderTemplateBody(body: string, variables: string[]) {
  return body.replace(/{{(\d+)}}/g, (_, index: string) => {
    const value = variables[Number(index) - 1];

    return value ?? `{{${index}}}`;
  });
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasClickSignal(message: PreviousMessageContext["message"]) {
  const metadata = isRecord(message.metadata) ? message.metadata : null;

  return Boolean(
    metadata?.clickedAt ||
      metadata?.linkClickedAt ||
      metadata?.buttonClickedAt ||
      metadata?.clickTrackedAt,
  );
}

async function hasReplyAfter({
  campaignId,
  contactId,
  since,
}: {
  campaignId: string;
  contactId: string;
  since: Date;
}) {
  const reply = await prisma.campaignReplyAttribution.findFirst({
    where: {
      campaignId,
      contactId,
      replyReceivedAt: {
        gt: since,
      },
      status: {
        not: "IGNORED",
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(reply);
}

async function conditionIsReady({
  campaignId,
  condition,
  contactId,
  previousMessage,
  since,
}: {
  campaignId: string;
  condition: "NO_REPLY" | "OPENED" | "CLICKED";
  contactId: string;
  previousMessage: PreviousMessageContext["message"];
  since: Date;
}) {
  if (condition === "NO_REPLY") {
    return !(await hasReplyAfter({ campaignId, contactId, since }));
  }

  if (condition === "OPENED") {
    return previousMessage.status === "READ";
  }

  return hasClickSignal(previousMessage);
}

async function createSkippedExecution({
  contactId,
  dueAt,
  reason,
  step,
  previousMessageId,
}: {
  contactId: string;
  dueAt: Date;
  previousMessageId: string;
  reason: string;
  step: {
    campaignId: string;
    companyId: string;
    id: string;
  };
}) {
  await prisma.campaignSequenceExecution
    .create({
      data: {
        campaignId: step.campaignId,
        companyId: step.companyId,
        contactId,
        dueAt,
        failureReason: reason,
        previousMessageId,
        skippedAt: new Date(),
        status: "SKIPPED",
        stepId: step.id,
      },
    })
    .catch(() => undefined);
}

async function queueSequenceMessage({
  context,
  dueAt,
  step,
}: {
  context: PreviousMessageContext;
  dueAt: Date;
  step: {
    campaignId: string;
    companyId: string;
    condition: "NO_REPLY" | "OPENED" | "CLICKED";
    id: string;
    order: number;
    template: {
      body: string;
      id: string;
      variables: string[];
    };
    variables: string[];
  };
}) {
  if (context.contact.isBlocked || context.contact.optedOutAt) {
    await createSkippedExecution({
      contactId: context.contactId,
      dueAt,
      previousMessageId: context.message.id,
      reason: context.contact.isBlocked
        ? "Contact is blocked"
        : "Contact opted out",
      step,
    });

    return null;
  }

  const variables =
    step.variables.length > 0 ? step.variables : context.variables;
  const body = renderTemplateBody(step.template.body, variables);
  const toPhoneNumber = `${context.contact.countryCode}${context.contact.phoneNumber}`;

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({
      where: {
        companyId: step.companyId,
      },
      select: {
        balancePaise: true,
      },
    });

    if (!wallet || wallet.balancePaise < MESSAGE_PRICE_PAISE) {
      const execution = await tx.campaignSequenceExecution.create({
        data: {
          campaignId: step.campaignId,
          companyId: step.companyId,
          contactId: context.contactId,
          dueAt,
          failureReason: "Insufficient wallet balance",
          previousMessageId: context.message.id,
          processedAt: new Date(),
          status: "FAILED",
          stepId: step.id,
        },
      });

      return {
        execution,
        message: null,
      };
    }

    const message = await tx.message.create({
      data: {
        body,
        campaignId: step.campaignId,
        companyId: step.companyId,
        contactId: context.contactId,
        direction: "OUTBOUND",
        events: {
          create: {
            companyId: step.companyId,
            raw: {
              campaignSequenceStepId: step.id,
              condition: step.condition,
              order: step.order,
              previousMessageId: context.message.id,
              source: "campaign_sequence",
            },
            status: "QUEUED",
          },
        },
        metadata: {
          campaignSequenceStepId: step.id,
          campaignSequenceStepOrder: step.order,
          messageType: "TEMPLATE",
          previousMessageId: context.message.id,
        },
        status: "QUEUED",
        templateId: step.template.id,
        toPhoneNumber,
        variables,
      },
    });

    const execution = await tx.campaignSequenceExecution.create({
      data: {
        campaignId: step.campaignId,
        companyId: step.companyId,
        contactId: context.contactId,
        dueAt,
        messageId: message.id,
        previousMessageId: context.message.id,
        processedAt: new Date(),
        status: "QUEUED",
        stepId: step.id,
      },
    });

    await tx.wallet.update({
      where: {
        companyId: step.companyId,
      },
      data: {
        balancePaise: {
          decrement: MESSAGE_PRICE_PAISE,
        },
      },
    });

    const walletTransaction = await tx.walletTransaction.create({
      data: {
        amountPaise: MESSAGE_PRICE_PAISE,
        companyId: step.companyId,
        description: "Campaign sequence message queued",
        referenceId: message.id,
        referenceType: "CAMPAIGN_SEQUENCE_USAGE",
        status: "SUCCESS",
        type: "DEBIT",
      },
    });

    await tx.messageUsageLedger.create({
      data: {
        amountPaise: MESSAGE_PRICE_PAISE,
        companyId: step.companyId,
        messageId: message.id,
        status: "CHARGED",
        walletTransactionId: walletTransaction.id,
      },
    });

    return {
      execution,
      message,
    };
  });

  if (result.message) {
    await getMessageQueue().add(
      "send-message",
      {
        companyId: step.companyId,
        messageId: result.message.id,
      },
      {
        jobId: `campaign-sequence:${result.execution.id}`,
      },
    );
  }

  return result.message;
}

async function getFirstStepContexts({
  campaignId,
  excludedContactIds,
  limit,
}: {
  campaignId: string;
  excludedContactIds: string[];
  limit: number;
}) {
  const campaignContacts = await prisma.campaignContact.findMany({
    where: {
      campaignId,
      contactId:
        excludedContactIds.length > 0
          ? {
              notIn: excludedContactIds,
            }
          : undefined,
      message: {
        is: {
          status: {
            in: ["SENT", "DELIVERED", "READ"],
          },
        },
      },
      status: {
        in: ["SENT", "DELIVERED", "READ"],
      },
    },
    include: {
      contact: {
        select: {
          countryCode: true,
          id: true,
          isBlocked: true,
          optedOutAt: true,
          phoneNumber: true,
        },
      },
      message: {
        select: {
          createdAt: true,
          id: true,
          metadata: true,
          status: true,
          updatedAt: true,
          variables: true,
        },
      },
    },
    orderBy: {
      updatedAt: "asc",
    },
    take: limit,
  });

  return campaignContacts.flatMap((campaignContact) =>
    campaignContact.message
      ? [
          {
            campaignContactId: campaignContact.id,
            contact: campaignContact.contact,
            contactId: campaignContact.contactId,
            message: campaignContact.message,
            variables: campaignContact.variables,
          },
        ]
      : [],
  );
}

async function getNextStepContexts({
  excludedContactIds,
  limit,
  previousStepId,
}: {
  excludedContactIds: string[];
  limit: number;
  previousStepId: string;
}) {
  const executions = await prisma.campaignSequenceExecution.findMany({
    where: {
      contactId:
        excludedContactIds.length > 0
          ? {
              notIn: excludedContactIds,
            }
          : undefined,
      message: {
        is: {
          status: {
            in: ["SENT", "DELIVERED", "READ"],
          },
        },
      },
      messageId: {
        not: null,
      },
      status: "SENT",
      stepId: previousStepId,
    },
    include: {
      contact: {
        select: {
          countryCode: true,
          id: true,
          isBlocked: true,
          optedOutAt: true,
          phoneNumber: true,
        },
      },
      message: {
        select: {
          createdAt: true,
          id: true,
          metadata: true,
          status: true,
          updatedAt: true,
          variables: true,
        },
      },
    },
    orderBy: {
      updatedAt: "asc",
    },
    take: limit,
  });

  return executions.flatMap((execution) =>
    execution.message
      ? [
          {
            contact: execution.contact,
            contactId: execution.contactId,
            message: execution.message,
            variables: execution.message.variables,
          },
        ]
      : [],
  );
}

export async function processCampaignSequences({
  batchSize = DEFAULT_BATCH_SIZE,
} = {}) {
  const now = new Date();
  const steps = await prisma.campaignSequenceStep.findMany({
    where: {
      campaign: {
        status: {
          in: ["RUNNING", "COMPLETED"],
        },
      },
      isActive: true,
      template: {
        status: "APPROVED",
      },
    },
    include: {
      template: {
        select: {
          body: true,
          id: true,
          variables: true,
        },
      },
    },
    orderBy: [
      {
        campaignId: "asc",
      },
      {
        order: "asc",
      },
    ],
  });

  let queued = 0;
  let skipped = 0;
  let failed = 0;

  for (const step of steps) {
    if (queued >= batchSize) break;

    const [existingExecutions, previousStep] = await Promise.all([
      prisma.campaignSequenceExecution.findMany({
        where: {
          stepId: step.id,
        },
        select: {
          contactId: true,
        },
      }),
      prisma.campaignSequenceStep.findFirst({
        where: {
          campaignId: step.campaignId,
          order: {
            lt: step.order,
          },
        },
        orderBy: {
          order: "desc",
        },
        select: {
          id: true,
        },
      }),
    ]);

    const excludedContactIds = existingExecutions.map(
      (execution) => execution.contactId,
    );
    const remaining = Math.max(batchSize - queued, 0);
    const contexts = previousStep
      ? await getNextStepContexts({
          excludedContactIds,
          limit: remaining,
          previousStepId: previousStep.id,
        })
      : await getFirstStepContexts({
          campaignId: step.campaignId,
          excludedContactIds,
          limit: remaining,
        });

    for (const context of contexts) {
      const previousMessageAt = context.message.updatedAt;
      const dueAt = addMinutes(previousMessageAt, step.delayMinutes);

      if (dueAt > now) continue;

      const ready = await conditionIsReady({
        campaignId: step.campaignId,
        condition: step.condition,
        contactId: context.contactId,
        previousMessage: context.message,
        since: previousMessageAt,
      });

      if (!ready) {
        if (step.condition === "NO_REPLY") {
          await createSkippedExecution({
            contactId: context.contactId,
            dueAt,
            previousMessageId: context.message.id,
            reason: "Contact replied before sequence step was due",
            step,
          });
          skipped += 1;
        }

        continue;
      }

      try {
        const message = await queueSequenceMessage({
          context,
          dueAt,
          step,
        });

        if (message) queued += 1;
        else skipped += 1;
      } catch (error) {
        failed += 1;

        if (
          isRecord(error) &&
          typeof error.code === "string" &&
          error.code === "P2002"
        ) {
          failed -= 1;
        } else {
          console.error("Campaign sequence step failed:", {
            contactId: context.contactId,
            error: error instanceof Error ? error.message : error,
            stepId: step.id,
          });
        }
      }
    }
  }

  return {
    failed,
    queued,
    skipped,
    steps: steps.length,
  };
}
