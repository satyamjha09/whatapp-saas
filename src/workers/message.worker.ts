import "dotenv/config";
import { UnrecoverableError, Worker } from "bullmq";
import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { DEFAULT_MESSAGE_JOB_ATTEMPTS, getMessageQueue } from "@/lib/queue";
import { getRedisConnection } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import {
  sendWhatsAppInteractiveMessage,
  sendWhatsAppLocationMessage,
  sendWhatsAppMediaMessage,
  sendWhatsAppTemplateMessage,
  sendWhatsAppTextMessage,
  type WhatsAppTemplateComponent,
  type WhatsAppTemplateParameter,
} from "@/lib/whatsapp";
import { enqueueDeveloperMessageStatusWebhook } from "@/server/services/developer-webhook.service";
import { publishCampaignDeveloperWebhookEvent } from "@/server/services/developer-webhook-event-publisher.service";
import { updateBulkMessageRecipientTracking } from "@/server/services/bulk-message-tracking.service";
import { analyzeCampaignFailures } from "@/server/services/campaign-failure-intelligence.service";
import {
  acquireCampaignSendSlot,
  recordCampaignProviderFailureForThroughput,
} from "@/server/services/campaign-throughput-guard.service";
import { refundWalletForMessage } from "@/server/services/wallet.service";
import type { SendMessageJobData } from "@/lib/queue";
import {
  isSystemMaintenanceModeEnabled,
  SystemMaintenanceModeError,
} from "@/server/services/system-maintenance-mode.service";
import { getWhatsAppAccessToken } from "@/server/services/whatsapp-secret.service";
import { readTemplateComponents } from "@/lib/whatsapp-template/template-variable-parser";
import { createWorkerHeartbeat } from "@/server/services/worker-heartbeat.service";
import {
  getFlowInteractionRuntimeForMessage,
  markFlowInteractionFailed,
  markFlowInteractionSent,
  readFlowTemplateRuntimeConfig,
} from "@/server/services/whatsapp-flow.service";

const heartbeat = createWorkerHeartbeat({
  workerName: process.env.WORKER_HEARTBEAT_NAME ?? "message-worker",
});

type OutboundMediaMetadata = {
  messageType: "MEDIA";
  mediaType: "IMAGE" | "DOCUMENT" | "VIDEO" | "AUDIO";
  mediaUrl?: string | null;
  mediaId?: string | null;
  mediaName?: string | null;
  caption?: string | null;
};

type OutboundLocationMetadata = {
  messageType: "LOCATION";
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

type OutboundInteractiveMetadata = {
  messageType: "INTERACTIVE";
  type:
    | "List Button"
    | "Reply Button"
    | "CTA Button"
    | "Call Permission Request"
    | "Location Request"
    | "Address Request"
    | "Flow";
  header?: string | null;
  headerMediaId?: string | null;
  headerMediaName?: string | null;
  headerMediaType?: "IMAGE" | "DOCUMENT" | "VIDEO" | null;
  headerMediaUrl?: string | null;
  body?: string | null;
  footer?: string | null;
  primaryButton?: string | null;
  buttons?: string[];
  ctaUrl?: string | null;
  flowId?: string | null;
  flowToken?: string | null;
  flowAction?: string | null;
  flowScreen?: string | null;
  flowData?: Record<string, unknown> | null;
  sections?: {
    title?: string | null;
    rows: { title: string; description?: string | null }[];
  }[];
};

function getOutboundMediaMetadata(
  metadata: unknown,
): OutboundMediaMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const mediaType = String(record.mediaType);

  if (
    record.messageType !== "MEDIA" ||
    !["IMAGE", "DOCUMENT", "VIDEO", "AUDIO"].includes(mediaType) ||
    (typeof record.mediaUrl !== "string" && typeof record.mediaId !== "string")
  ) {
    return null;
  }

  return {
    messageType: "MEDIA",
    mediaType: mediaType as OutboundMediaMetadata["mediaType"],
    mediaUrl: typeof record.mediaUrl === "string" ? record.mediaUrl : null,
    mediaId: typeof record.mediaId === "string" ? record.mediaId : null,
    mediaName:
      typeof record.mediaName === "string" ? record.mediaName : null,
    caption: typeof record.caption === "string" ? record.caption : null,
  };
}

function getOutboundLocationMetadata(
  metadata: unknown,
): OutboundLocationMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;

  if (
    record.messageType !== "LOCATION" ||
    typeof record.name !== "string" ||
    typeof record.address !== "string" ||
    typeof record.latitude !== "number" ||
    typeof record.longitude !== "number"
  ) {
    return null;
  }

  return {
    messageType: "LOCATION",
    name: record.name,
    address: record.address,
    latitude: record.latitude,
    longitude: record.longitude,
  };
}

type MetaComponentType = {
  type: string;
  format?: string;
  text?: string;
  buttons?: Array<Record<string, unknown>>;
};

type FlowTemplateRuntime = {
  flowToken: string;
};

function buildMetaComponentsPayload(
  components: MetaComponentType[],
  variableMap: Map<string, string>,
  flowRuntime?: FlowTemplateRuntime | null,
): WhatsAppTemplateComponent[] {
  const result: WhatsAppTemplateComponent[] = [];

  for (const component of components) {
    if (component.type === "HEADER") {
      if (component.format === "TEXT") {
        const matches = Array.from(new Set(component.text?.match(/{{\d+}}/g) ?? [])) as string[];
        matches.sort((left, right) => Number(left.slice(2, -2)) - Number(right.slice(2, -2)));

        if (matches.length > 0) {
          result.push({
            type: "header",
            parameters: matches.map((m) => {
              const num = m.slice(2, -2);
              const val = variableMap.get(`HEADER_${num}`) || "";
              return {
                type: "text",
                text: val,
              };
            }),
          });
        }
      } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(component.format || "")) {
        const mediaUrl = variableMap.get("HEADER_MEDIA") || "";
        if (mediaUrl) {
          const format = component.format || "";
          const type = format.toLowerCase() as "image" | "video" | "document";
          result.push({
            type: "header",
            parameters: [
              {
                type,
                [type]: {
                  link: mediaUrl,
                },
              } as unknown as WhatsAppTemplateParameter,
            ],
          });
        }
      }
    }

    if (component.type === "BODY") {
      const matches = Array.from(new Set(component.text?.match(/{{\d+}}/g) ?? [])) as string[];
      matches.sort((left, right) => Number(left.slice(2, -2)) - Number(right.slice(2, -2)));

      if (matches.length > 0) {
        result.push({
          type: "body",
          parameters: matches.map((m) => {
            const num = m.slice(2, -2);
            const val = variableMap.get(`BODY_${num}`) || "";
            return {
              type: "text",
              text: val,
            };
          }),
        });
      }
    }

    if (component.type === "BUTTONS" && Array.isArray(component.buttons)) {
      component.buttons.forEach((button: Record<string, unknown>, btnIdx: number) => {
        if (button.type === "URL" && typeof button.url === "string") {
          const matches = Array.from(new Set(button.url.match(/{{\d+}}/g) ?? [])) as string[];
          matches.sort((left, right) => Number(left.slice(2, -2)) - Number(right.slice(2, -2)));

          if (matches.length > 0) {
            result.push({
              type: "button",
              sub_type: "url",
              index: String(btnIdx),
              parameters: matches.map((m) => {
                const num = m.slice(2, -2);
                const val = variableMap.get(`BUTTON_${btnIdx}_${num}`) || "";
                return {
                  type: "text",
                  text: val,
                };
              }),
            });
          }
        }

        if (button.type === "FLOW" && flowRuntime) {
          result.push({
            type: "button",
            sub_type: "flow",
            index: String(btnIdx),
            parameters: [
              {
                action: {
                  flow_token: flowRuntime.flowToken,
                },
                type: "action",
              },
            ],
          });
        }
      });
    }
  }

  return result;
}

function getOutboundInteractiveMetadata(
  metadata: unknown,
): OutboundInteractiveMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  const type = String(record.type);

  if (
    record.messageType !== "INTERACTIVE" ||
    ![
      "List Button",
      "Reply Button",
      "CTA Button",
      "Call Permission Request",
      "Location Request",
      "Address Request",
      "Flow",
    ].includes(type)
  ) {
    return null;
  }

  return {
    messageType: "INTERACTIVE",
    type: type as OutboundInteractiveMetadata["type"],
    header: typeof record.header === "string" ? record.header : null,
    headerMediaId:
      typeof record.headerMediaId === "string" ? record.headerMediaId : null,
    headerMediaName:
      typeof record.headerMediaName === "string"
        ? record.headerMediaName
        : null,
    headerMediaType:
      record.headerMediaType === "IMAGE" ||
      record.headerMediaType === "DOCUMENT" ||
      record.headerMediaType === "VIDEO"
        ? record.headerMediaType
        : null,
    headerMediaUrl:
      typeof record.headerMediaUrl === "string" ? record.headerMediaUrl : null,
    body: typeof record.body === "string" ? record.body : null,
    footer: typeof record.footer === "string" ? record.footer : null,
    primaryButton:
      typeof record.primaryButton === "string" ? record.primaryButton : null,
    buttons: Array.isArray(record.buttons)
      ? record.buttons.filter(
          (button): button is string => typeof button === "string",
        )
      : [],
    ctaUrl: typeof record.ctaUrl === "string" ? record.ctaUrl : null,
    flowId: typeof record.flowId === "string" ? record.flowId : null,
    flowToken:
      typeof record.flowToken === "string" ? record.flowToken : null,
    flowAction:
      typeof record.flowAction === "string" ? record.flowAction : null,
    flowScreen:
      typeof record.flowScreen === "string" ? record.flowScreen : null,
    flowData:
      record.flowData &&
      typeof record.flowData === "object" &&
      !Array.isArray(record.flowData)
        ? (record.flowData as Record<string, unknown>)
        : null,
    sections: Array.isArray(record.sections)
      ? record.sections
          .filter(
            (section): section is Record<string, unknown> =>
              Boolean(section) &&
              typeof section === "object" &&
              !Array.isArray(section),
          )
          .map((section) => ({
            title: typeof section.title === "string" ? section.title : null,
            rows: Array.isArray(section.rows)
              ? section.rows
                  .filter(
                    (row): row is Record<string, unknown> =>
                      Boolean(row) &&
                      typeof row === "object" &&
                      !Array.isArray(row) &&
                      typeof row.title === "string",
                  )
                  .map((row) => ({
                    title: String(row.title),
                    description:
                      typeof row.description === "string"
                        ? row.description
                        : null,
                  }))
              : [],
          }))
      : [],
  };
}

function textComponent(text?: string | null) {
  return text?.trim() ? { text: text.trim() } : undefined;
}

function buildInteractiveHeader(metadata: OutboundInteractiveMetadata) {
  if (
    metadata.headerMediaType &&
    (metadata.headerMediaId || metadata.headerMediaUrl)
  ) {
    const mediaKind = metadata.headerMediaType.toLowerCase() as
      | "document"
      | "image"
      | "video";
    const mediaPayload: Record<string, string> = metadata.headerMediaId
      ? { id: metadata.headerMediaId }
      : { link: metadata.headerMediaUrl ?? "" };

    if (mediaKind === "document" && metadata.headerMediaName) {
      mediaPayload.filename = metadata.headerMediaName;
    }

    return {
      type: mediaKind,
      [mediaKind]: mediaPayload,
    };
  }

  const header = textComponent(metadata.header);

  return header ? { type: "text", text: header.text } : undefined;
}

function buildInteractivePayload(metadata: OutboundInteractiveMetadata) {
  const body = textComponent(metadata.body) ?? { text: " " };
  const header = buildInteractiveHeader(metadata);
  const footer = textComponent(metadata.footer);

  if (metadata.type === "List Button") {
    return {
      type: "list",
      ...(header ? { header } : {}),
      body,
      ...(footer ? { footer } : {}),
      action: {
        button: metadata.primaryButton || "View options",
        sections:
          metadata.sections?.map((section, sectionIndex) => ({
            title: section.title || `Section ${sectionIndex + 1}`,
            rows: section.rows.map((row, rowIndex) => ({
              id: `section_${sectionIndex + 1}_row_${rowIndex + 1}`,
              title: row.title,
              ...(row.description ? { description: row.description } : {}),
            })),
          })) ?? [],
      },
    };
  }

  if (metadata.type === "Reply Button") {
    return {
      type: "button",
      ...(header ? { header } : {}),
      body,
      ...(footer ? { footer } : {}),
      action: {
        buttons: (metadata.buttons?.length ? metadata.buttons : ["Button 1"]).map(
          (button, index) => ({
            type: "reply",
            reply: {
              id: `reply_${index + 1}`,
              title: button,
            },
          }),
        ),
      },
    };
  }

  if (metadata.type === "CTA Button") {
    return {
      type: "cta_url",
      ...(header ? { header } : {}),
      body,
      ...(footer ? { footer } : {}),
      action: {
        name: "cta_url",
        parameters: {
          display_text: metadata.primaryButton || "Open link",
          url: metadata.ctaUrl,
        },
      },
    };
  }

  if (metadata.type === "Location Request") {
    return {
      type: "location_request_message",
      body,
      action: {
        name: "send_location",
      },
    };
  }

  if (metadata.type === "Address Request") {
    return {
      type: "address_message",
      body,
      action: {
        name: "address_message",
        parameters: {
          country: "IN",
        },
      },
    };
  }

  if (metadata.type === "Flow") {
    if (!metadata.flowId) {
      throw new Error("Flow ID is required");
    }

    if (!metadata.flowToken) {
      throw new Error("Flow token is required");
    }

    return {
      type: "flow",
      ...(header ? { header } : {}),
      body,
      ...(footer ? { footer } : {}),
      action: {
        name: "flow",
        parameters: {
          flow_message_version: "3",
          flow_token: metadata.flowToken,
          flow_id: metadata.flowId,
          flow_cta: metadata.primaryButton || "Open Flow",
          flow_action: metadata.flowAction || "navigate",
          flow_action_payload: {
            ...(metadata.flowScreen ? { screen: metadata.flowScreen } : {}),
            ...(metadata.flowData ? { data: metadata.flowData } : {}),
          },
        },
      },
    };
  }

  return {
    type: "call_permission_request",
    body,
    action: {
      name: "call_permission_request",
    },
  };
}

async function updateCampaignCompletion(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: {
      id: campaignId,
    },
    include: {
      contacts: true,
    },
  });

  if (!campaign) {
    return;
  }

  const allFinished = campaign.contacts.every((contact) =>
    ["SENT", "DELIVERED", "READ", "FAILED", "SKIPPED"].includes(
      contact.status,
    ),
  );

  if (!allFinished) {
    return;
  }

  const hasFailed = campaign.contacts.some(
    (contact) => contact.status === "FAILED",
  );

  const updatedCampaign = await prisma.campaign.update({
    where: {
      id: campaign.id,
    },
    data: {
      status: hasFailed ? "FAILED" : "COMPLETED",
    },
  });

  await publishCampaignDeveloperWebhookEvent({
    companyId: updatedCampaign.companyId,
    campaign: updatedCampaign,
    operation: "completed",
  });
}

async function markCampaignMessageSent(message: {
  campaignContactId: string | null;
  campaignId: string | null;
  id: string;
}) {
  if (message.campaignContactId) {
    await prisma.campaignContact.update({
      where: {
        id: message.campaignContactId,
      },
      data: {
        status: "SENT",
      },
    });
  }

  await prisma.campaignLaunchRecipient.updateMany({
    where: {
      messageId: message.id,
      status: {
        in: ["QUEUED", "MESSAGE_CREATED", "PROCESSING"],
      },
    },
    data: {
      sentAt: new Date(),
      status: "SENT",
    },
  });

  if (message.campaignId) {
    await prisma.campaignSequenceExecution.updateMany({
      where: {
        messageId: message.id,
        status: "QUEUED",
      },
      data: {
        processedAt: new Date(),
        status: "SENT",
      },
    });

    await prisma.campaign.update({
      where: {
        id: message.campaignId,
      },
      data: {
        sentCount: {
          increment: 1,
        },
      },
    });

    await updateCampaignCompletion(message.campaignId);
  }
}

async function markMessageAsFailed(
  messageId: string,
  companyId: string,
  reason: string,
) {
  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      companyId,
    },
  });

  if (
    !message ||
    message.status === "FAILED" ||
    message.status === "CANCELED"
  ) {
    return;
  }

  await prisma.message.update({
    where: {
      id: message.id,
    },
    data: {
      status: "FAILED",
      errorMessage: reason,
      events: {
        create: {
          companyId,
          status: "FAILED",
          raw: {
            source: "worker",
            reason,
          },
        },
      },
    },
  });

  await markFlowInteractionFailed({
    companyId,
    messageId: message.id,
    reason,
  });

  await prisma.campaignSequenceExecution.updateMany({
    where: {
      messageId: message.id,
      status: {
        in: ["PENDING", "QUEUED"],
      },
    },
    data: {
      failureReason: reason,
      processedAt: new Date(),
      status: "FAILED",
    },
  });

  await updateBulkMessageRecipientTracking(message.id, "FAILED", reason);
  await enqueueDeveloperMessageStatusWebhook(companyId, message.id);

  await refundWalletForMessage(
    companyId,
    MESSAGE_PRICE_PAISE,
    "Message sending failed refund",
    message.id,
  );

  if (message.campaignContactId) {
    await prisma.campaignContact.update({
      where: {
        id: message.campaignContactId,
      },
      data: {
        status: "FAILED",
      },
    });
  }

  await prisma.campaignLaunchRecipient.updateMany({
    where: {
      messageId: message.id,
      status: {
        notIn: ["READ", "REPLIED"],
      },
    },
    data: {
      failedAt: new Date(),
      failureReason: reason,
      status: "FAILED",
    },
  });

  if (message.campaignId) {
    await prisma.campaign.update({
      where: {
        id: message.campaignId,
      },
      data: {
        failedCount: {
          increment: 1,
        },
      },
    });

    await updateCampaignCompletion(message.campaignId);

    if (process.env.CAMPAIGN_FAILURE_AUTO_ANALYZE_ON_FAILURE !== "false") {
      await analyzeCampaignFailures({
        companyId: message.companyId,
        campaignId: message.campaignId,
      }).catch(() => undefined);
    }
  }
}

async function markMessageForRetry(
  messageId: string,
  companyId: string,
  reason: string,
  attemptNumber: number,
  maxAttempts: number,
) {
  await prisma.message.updateMany({
    where: {
      id: messageId,
      companyId,
      status: "SENDING",
    },
    data: {
      status: "RETRY_PENDING",
    },
  });

  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      companyId,
      status: "RETRY_PENDING",
    },
    select: {
      id: true,
    },
  });

  if (!message) {
    return;
  }

  await prisma.messageEvent.create({
    data: {
      companyId,
      messageId,
      status: "RETRY_PENDING",
      raw: {
        source: "worker",
        reason,
        attemptNumber,
        maxAttempts,
      },
    },
  });
}

function getMaxAttempts(jobAttempts?: number) {
  return jobAttempts && jobAttempts > 0
    ? jobAttempts
    : DEFAULT_MESSAGE_JOB_ATTEMPTS;
}

function isFinalAttempt(attemptsMade: number, maxAttempts: number) {
  return attemptsMade + 1 >= maxAttempts;
}

function getHttpStatus(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error.response &&
    typeof error.response === "object" &&
    "status" in error.response &&
    typeof error.response.status === "number"
  ) {
    return error.response.status;
  }

  return null;
}

function isPermanentMessageSendError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "Message not found") {
    return true;
  }

  const httpStatus = getHttpStatus(error);

  if (!httpStatus) {
    return false;
  }

  if (httpStatus === 429 || httpStatus >= 500) {
    return false;
  }

  return httpStatus >= 400 && httpStatus < 500;
}

function isMessageSimulationEnabled() {
  return process.env.ENABLE_MESSAGE_SIMULATION === "true";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorCode(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code !== undefined &&
    error.code !== null
  ) {
    return String(error.code);
  }

  return null;
}

function getHeaderValue(headers: unknown, name: string) {
  if (!headers || typeof headers !== "object") return null;

  if ("get" in headers && typeof headers.get === "function") {
    const value = headers.get(name);
    return typeof value === "string" ? value : null;
  }

  const record = headers as Record<string, unknown>;
  const direct = record[name] ?? record[name.toLowerCase()];
  return typeof direct === "string" ? direct : null;
}

function getRetryAfterMs(error: unknown) {
  if (
    !error ||
    typeof error !== "object" ||
    !("response" in error) ||
    !error.response ||
    typeof error.response !== "object" ||
    !("headers" in error.response)
  ) {
    return null;
  }

  const retryAfter = getHeaderValue(error.response.headers, "retry-after");
  if (!retryAfter) return null;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.floor(seconds * 1000);
  }

  const retryDate = Date.parse(retryAfter);
  if (Number.isFinite(retryDate)) {
    return Math.max(1000, retryDate - Date.now());
  }

  return null;
}

async function markMessageForThroughputRetry({
  companyId,
  jobName,
  messageId,
  reason,
  retryAfterMs,
}: {
  companyId: string;
  jobName: string;
  messageId: string;
  reason: string;
  retryAfterMs: number;
}) {
  const updated = await prisma.message.updateMany({
    where: {
      companyId,
      id: messageId,
      status: {
        in: ["QUEUED", "RETRY_PENDING"],
      },
    },
    data: {
      status: "RETRY_PENDING",
    },
  });

  if (updated.count !== 1) {
    return;
  }

  await prisma.messageEvent.create({
    data: {
      companyId,
      messageId,
      raw: {
        reason,
        retryAfterMs,
        source: "campaign_throughput_guard",
      },
      status: "RETRY_PENDING",
    },
  });

  await getMessageQueue().add(
    jobName,
    { companyId, messageId },
    {
      delay: retryAfterMs,
      jobId: `throughput:${messageId}:${Date.now()}`,
    },
  );
}

const worker = new Worker<SendMessageJobData>(
  "message-queue",
  async (job) => {
    const { messageId, companyId } = job.data;
    let campaignId: string | null = null;

    try {
      console.log("Processing message job:", job.id, messageId);

      if (await isSystemMaintenanceModeEnabled()) {
        throw new SystemMaintenanceModeError(
          "System maintenance mode is enabled. Message send will retry later.",
        );
      }

      const message = await prisma.message.findFirst({
        where: {
          id: messageId,
          companyId,
        },
        include: {
          template: true,
        },
      });

      if (!message) {
        throw new Error("Message not found");
      }

      campaignId = message.campaignId;

      if (message.status === "CANCELED") {
        return;
      }

      if (!["QUEUED", "RETRY_PENDING"].includes(message.status)) {
        return;
      }

      if (message.campaignId) {
        const decision = await acquireCampaignSendSlot({
          campaignId: message.campaignId,
          companyId,
        });

        if (!decision.allowed) {
          await markMessageForThroughputRetry({
            companyId,
            jobName: job.name,
            messageId: message.id,
            reason: decision.reason,
            retryAfterMs: decision.retryAfterMs,
          });

          return;
        }

        if (decision.delayMs > 0) {
          await sleep(decision.delayMs);
        }
      }

      const claimedForSending = await prisma.$transaction(async (tx) => {
        const bulkRecipient = await tx.bulkMessageBatchRecipient.findUnique({
          where: { messageId: message.id },
          select: { batchId: true },
        });

        if (bulkRecipient) {
          const scheduledBatchClaim = await tx.bulkMessageBatch.updateMany({
            where: {
              id: bulkRecipient.batchId,
              status: "SCHEDULED",
            },
            data: { status: "QUEUED" },
          });

          if (scheduledBatchClaim.count === 0) {
            const currentBatch = await tx.bulkMessageBatch.findUnique({
              where: { id: bulkRecipient.batchId },
              select: { status: true },
            });

            if (currentBatch?.status === "CANCELED") return false;
          }
        }

        const messageClaim = await tx.message.updateMany({
          where: {
            id: message.id,
            companyId,
            status: {
              in: ["QUEUED", "RETRY_PENDING"],
            },
          },
          data: { status: "SENDING" },
        });

        if (messageClaim.count !== 1) return false;

        await tx.messageEvent.create({
          data: {
            companyId,
            messageId: message.id,
            status: "SENDING",
            raw: {
              source: "worker",
              jobId: job.id,
            },
          },
        });

        return true;
      });

      if (!claimedForSending) return;

      await updateBulkMessageRecipientTracking(message.id, "SENDING");

      const whatsAppAccount = await prisma.whatsAppAccount.findFirst({
        where: {
          companyId,
          status: "CONNECTED",
        },
        include: {
          phoneNumbers: true,
        },
      });

      const phoneNumber = whatsAppAccount?.phoneNumbers[0];

      const hasCompanyWhatsAppCredentials =
        Boolean(whatsAppAccount?.accessToken) &&
        Boolean(phoneNumber?.phoneNumberId);

      if (!hasCompanyWhatsAppCredentials) {
        if (!isMessageSimulationEnabled()) {
          throw new UnrecoverableError(
            "WhatsApp credentials are missing. Connect a WhatsApp account, access token, and phone number ID before sending messages.",
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));

        const fakeMetaMessageId = `dev_meta_${message.id}`;

        await prisma.message.update({
          where: {
            id: message.id,
          },
          data: {
            status: "SENT",
            metaMessageId: fakeMetaMessageId,
            events: {
              create: {
                companyId,
                status: "SENT",
                raw: {
                  source: "worker",
                  mode: "development_simulation",
                  jobId: job.id,
                  metaMessageId: fakeMetaMessageId,
                },
              },
            },
          },
        });

        await markFlowInteractionSent({
          companyId,
          messageId: message.id,
          metaMessageId: fakeMetaMessageId,
        });

        await updateBulkMessageRecipientTracking(message.id, "SENT");
        await enqueueDeveloperMessageStatusWebhook(companyId, message.id);

        await markCampaignMessageSent(message);

        console.log("Message sent in dev mode:", message.id);
        return;
      }

      const decryptedAccessToken = await getWhatsAppAccessToken({ companyId });
      const media = getOutboundMediaMetadata(message.metadata);
      const location = getOutboundLocationMetadata(message.metadata);
      const interactive = getOutboundInteractiveMetadata(message.metadata);

      const template = message.template;
      const result = template
        ? await (async () => {
            const templateComponents = readTemplateComponents(template) as MetaComponentType[];
            const flowTemplateConfig = readFlowTemplateRuntimeConfig(
              template.components,
            );
            const flowRuntime = flowTemplateConfig
              ? await getFlowInteractionRuntimeForMessage({
                  companyId,
                  messageId: message.id,
                })
              : null;
            const variableMap = new Map<string, string>();
            const templateKeys = (template.variables as string[]) || [];
            templateKeys.forEach((key, idx) => {
              variableMap.set(key, message.variables[idx] || "");
            });

            const hasNamespace = templateKeys.some((k) => k.startsWith("BODY_") || k.startsWith("HEADER_") || k.startsWith("BUTTON_"));

            const components = hasNamespace || flowTemplateConfig
              ? buildMetaComponentsPayload(
                  templateComponents,
                  variableMap,
                  flowTemplateConfig && flowRuntime
                    ? {
                        flowToken: flowRuntime.flowToken,
                      }
                    : null,
                )
              : undefined;

            return sendWhatsAppTemplateMessage({
              accessToken: decryptedAccessToken,
              phoneNumberId: phoneNumber!.phoneNumberId!,
              to: message.toPhoneNumber,
              templateName: template.name,
              languageCode: template.language,
              variables: components ? undefined : message.variables,
              components: components ?? undefined,
            });
          })()
        : media
          ? await sendWhatsAppMediaMessage({
              accessToken: decryptedAccessToken,
              phoneNumberId: phoneNumber!.phoneNumberId!,
              to: message.toPhoneNumber,
              mediaType: media.mediaType,
              mediaUrl: media.mediaUrl ?? undefined,
              mediaId: media.mediaId ?? undefined,
              caption: media.caption ?? undefined,
              filename: media.mediaName ?? undefined,
            })
        : location
          ? await sendWhatsAppLocationMessage({
              accessToken: decryptedAccessToken,
              phoneNumberId: phoneNumber!.phoneNumberId!,
              to: message.toPhoneNumber,
              latitude: location.latitude,
              longitude: location.longitude,
              name: location.name,
              address: location.address,
            })
        : interactive
          ? await sendWhatsAppInteractiveMessage({
              accessToken: decryptedAccessToken,
              phoneNumberId: phoneNumber!.phoneNumberId!,
              to: message.toPhoneNumber,
              interactive: buildInteractivePayload(interactive),
            })
        : await sendWhatsAppTextMessage({
            accessToken: decryptedAccessToken,
            phoneNumberId: phoneNumber!.phoneNumberId!,
            to: message.toPhoneNumber,
            body: message.body,
          });

      await prisma.message.update({
        where: {
          id: message.id,
        },
        data: {
          status: "SENT",
          metaMessageId: result.metaMessageId,
          events: {
            create: {
              companyId,
              status: "SENT",
              raw: {
                source: "worker",
                mode: "meta_cloud_api",
                jobId: job.id,
                metaResponse: result.raw,
              },
            },
          },
        },
      });

      await markFlowInteractionSent({
        companyId,
        messageId: message.id,
        metaMessageId: result.metaMessageId,
      });

      await updateBulkMessageRecipientTracking(message.id, "SENT");
      await enqueueDeveloperMessageStatusWebhook(companyId, message.id);

      await markCampaignMessageSent(message);

      console.log(
        message.template
          ? "Template message sent using Meta API:"
          : media
            ? "Media message sent using Meta API:"
            : location
              ? "Location message sent using Meta API:"
              : interactive
                ? "Interactive message sent using Meta API:"
                : "Session reply sent using Meta API:",
        message.id,
      );
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "Unknown worker error";

      console.error("MESSAGE_WORKER_PROCESSING_ERROR:", reason);

      if (error instanceof SystemMaintenanceModeError) {
        throw error;
      }

      if (campaignId) {
        await recordCampaignProviderFailureForThroughput({
          campaignId,
          companyId,
          errorCode: getErrorCode(error),
          errorMessage: reason,
          retryAfterMs: getRetryAfterMs(error),
        }).catch(() => undefined);
      }

      const maxAttempts = getMaxAttempts(job.opts.attempts);
      const permanentFailure = isPermanentMessageSendError(error);
      const finalAttempt = isFinalAttempt(job.attemptsMade, maxAttempts);

      if (permanentFailure || finalAttempt) {
        await markMessageAsFailed(messageId, companyId, reason);

        if (permanentFailure && !finalAttempt) {
          throw new UnrecoverableError(reason);
        }

        throw error;
      }

      await markMessageForRetry(
        messageId,
        companyId,
        reason,
        job.attemptsMade + 1,
        maxAttempts,
      );

      throw error;
    }
  },
  {
    connection: getRedisConnection(),
  },
);

void heartbeat.start();

worker.on("completed", (job) => {
  console.log(`Job completed: ${job.id}`);
});

worker.on("failed", async (job, error) => {
  console.error(`Job failed: ${job?.id}`, error);
  await heartbeat.markError(error);
});

console.log("Message worker is running...");

async function shutdown() {
  await worker.close();
  await heartbeat.stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
