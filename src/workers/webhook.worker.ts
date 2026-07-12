import "dotenv/config";
import { Worker } from "bullmq";
import { getRedisConnection } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import {
  enqueueDeveloperInboundMessageWebhook,
  enqueueDeveloperMessageStatusWebhook,
} from "@/server/services/developer-webhook.service";
import {
  grantMarketingConsent,
  revokeMarketingConsent,
} from "@/server/services/contact-consent.service";
import { recordContactActivity } from "@/server/services/contact-activity.service";
import { updateBulkMessageRecipientTracking } from "@/server/services/bulk-message-tracking.service";
import { attributeInboundCampaignReply } from "@/server/services/campaign-reply-attribution.service";
import { calculateInboxSlaDueAt } from "@/server/services/inbox-sla.service";
import { queueLeadScoreRecalculation } from "@/server/services/lead-scoring.service";
import { publishInboxRealtimeEvent } from "@/server/realtime/inbox-events";
import { createUnmappedWebhookEvent } from "@/server/services/webhook.service";
import {
  isWhatsAppFlowResponseMessage,
  parseWhatsAppFlowResponse,
  recordWhatsAppFlowResponse,
  sanitizeWhatsAppFlowPayloadForStorage,
  WhatsAppFlowResponseCaptureError,
} from "@/server/services/whatsapp-flow.service";
import { recordWhatsAppCatalogInteraction } from "@/server/services/whatsapp-catalog-interaction.service";
import { processChatbotInboundMessage } from "@/server/services/chatbot-runtime.service";
import { queueAutomationRuntimeJob } from "@/server/services/automation-runtime.service";
import type { Prisma } from "@/generated/prisma/client";
import type { MessageStatus } from "@/generated/prisma/enums";
import type { ProcessWebhookJobData } from "@/lib/queue";
import { createWorkerHeartbeat } from "@/server/services/worker-heartbeat.service";

const heartbeat = createWorkerHeartbeat({
  workerName: "webhook-worker",
});

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" ? (value as JsonRecord) : null;
}

function firstArrayItem(value: unknown) {
  return Array.isArray(value) ? value[0] : undefined;
}

function extractStatuses(payload: unknown) {
  const root = asRecord(payload);
  const entry = asRecord(firstArrayItem(root?.entry));
  const change = asRecord(firstArrayItem(entry?.changes));
  const value = asRecord(change?.value);
  const statuses = value?.statuses;

  return Array.isArray(statuses) ? statuses : [];
}

function extractIncomingMessages(payload: unknown) {
  const root = asRecord(payload);
  const entry = asRecord(firstArrayItem(root?.entry));
  const change = asRecord(firstArrayItem(entry?.changes));
  const value = asRecord(change?.value);
  const messages = value?.messages;

  return Array.isArray(messages) ? messages : [];
}

function extractPhoneNumberId(payload: unknown) {
  const root = asRecord(payload);
  const entry = asRecord(firstArrayItem(root?.entry));
  const change = asRecord(firstArrayItem(entry?.changes));
  const value = asRecord(change?.value);
  const metadata = asRecord(value?.metadata);
  const phoneNumberId = metadata?.phone_number_id;

  return typeof phoneNumberId === "string" ? phoneNumberId : null;
}

function extractWebhookContacts(payload: unknown) {
  const root = asRecord(payload);
  const entry = asRecord(firstArrayItem(root?.entry));
  const change = asRecord(firstArrayItem(entry?.changes));
  const value = asRecord(change?.value);
  const contacts = value?.contacts;

  return Array.isArray(contacts) ? contacts : [];
}

function getContactNameFromPayload(payload: unknown, waId: string) {
  const contacts = extractWebhookContacts(payload);

  for (const contactValue of contacts) {
    const contact = asRecord(contactValue);

    if (contact?.wa_id !== waId) {
      continue;
    }

    const profile = asRecord(contact.profile);
    const name = profile?.name;

    return typeof name === "string" ? name : null;
  }

  return null;
}

function splitInboundPhoneNumber(phoneNumber: string) {
  // ITU-T E.164 country codes sorted by length descending to match longest first
  const countryCodes = [
    // 3-digit codes
    "211", "212", "213", "216", "218", "220", "221", "222", "223", "224", "225", "226", "227", "228", "229",
    "230", "231", "232", "233", "234", "235", "236", "237", "238", "239", "240", "241", "242", "243", "244",
    "245", "248", "249", "250", "251", "252", "253", "254", "255", "256", "257", "258", "260", "261", "262",
    "263", "264", "265", "266", "267", "268", "269", "290", "291", "297", "298", "299", "350", "351", "352",
    "353", "354", "355", "356", "357", "358", "359", "370", "371", "372", "373", "374", "375", "376", "377",
    "378", "380", "381", "382", "383", "385", "386", "387", "389", "420", "421", "423", "500", "501", "502",
    "503", "504", "505", "506", "507", "508", "509", "590", "591", "592", "593", "594", "595", "597", "598",
    "599", "670", "672", "673", "674", "675", "676", "677", "678", "679", "680", "681", "682", "683", "685",
    "686", "687", "688", "689", "690", "691", "692", "850", "852", "853", "855", "856", "880", "886", "960",
    "961", "962", "963", "964", "965", "966", "967", "968", "970", "971", "972", "973", "974", "975", "976",
    "977", "992", "993", "994", "995", "996", "998",
    // 2-digit codes
    "20", "27", "30", "31", "32", "33", "34", "36", "39", "40", "41", "43", "44", "45", "46", "47", "48",
    "49", "51", "52", "53", "54", "55", "56", "57", "58", "60", "61", "62", "63", "64", "65", "66", "81",
    "82", "84", "86", "90", "91", "92", "93", "94", "95", "98",
    // 1-digit codes
    "1", "7"
  ];

  const digits = phoneNumber.replace(/\D/g, "");

  for (const code of countryCodes) {
    if (digits.startsWith(code)) {
      const rest = digits.slice(code.length);
      // E.164 subscriber numbers must be at least 4 digits
      if (rest.length >= 4) {
        return {
          countryCode: code,
          phoneNumber: rest,
        };
      }
    }
  }

  return {
    countryCode: "",
    phoneNumber: digits,
  };
}

function getStringValue(record: JsonRecord | null, key: string) {
  const value = record?.[key];

  return typeof value === "string" ? value : null;
}

function getNumberValue(record: JsonRecord | null, key: string) {
  const value = record?.[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getInboundMediaType(type: unknown) {
  switch (type) {
    case "image":
      return "IMAGE";
    case "audio":
      return "AUDIO";
    case "video":
      return "VIDEO";
    case "document":
      return "DOCUMENT";
    case "sticker":
      return "STICKER";
    default:
      return null;
  }
}

function getInboundContextMetadata(message: JsonRecord): Prisma.InputJsonObject {
  const context = asRecord(message.context);
  const referral = asRecord(message.referral);
  const metadata: Record<string, Prisma.InputJsonValue> = {};

  if (context) {
    const contextId = getStringValue(context, "id");
    const contextFrom = getStringValue(context, "from");

    if (contextId) metadata.contextMetaMessageId = contextId;
    if (contextFrom) metadata.contextFrom = contextFrom;
  }

  if (referral) {
    metadata.referral = referral as Prisma.InputJsonValue;
  }

  return metadata as Prisma.InputJsonObject;
}

function attachInboundContext(
  message: JsonRecord,
  metadata: Prisma.InputJsonObject,
) {
  return {
    ...metadata,
    ...getInboundContextMetadata(message),
  };
}

function getInboundMessageMetadata(
  message: JsonRecord,
): Prisma.InputJsonObject | undefined {
  const mediaType = getInboundMediaType(message.type);

  if (mediaType) {
    const mediaPayload = asRecord(message[String(message.type)]);
    const caption = getStringValue(mediaPayload, "caption");
    const filename = getStringValue(mediaPayload, "filename");
    const mimeType = getStringValue(mediaPayload, "mime_type");

    return attachInboundContext(message, {
      messageType: "MEDIA",
      direction: "INBOUND",
      mediaType,
      mediaId: getStringValue(mediaPayload, "id"),
      mediaName: filename,
      caption,
      mimeType,
      sha256: getStringValue(mediaPayload, "sha256"),
      animated:
        typeof mediaPayload?.animated === "boolean"
          ? mediaPayload.animated
          : null,
    });
  }

  if (message.type === "location") {
    const location = asRecord(message.location);
    const latitude = getNumberValue(location, "latitude");
    const longitude = getNumberValue(location, "longitude");

    return attachInboundContext(message, {
      messageType: "LOCATION",
      direction: "INBOUND",
      latitude,
      longitude,
      name: getStringValue(location, "name"),
      address: getStringValue(location, "address"),
    });
  }

  if (message.type === "reaction") {
    const reaction = asRecord(message.reaction);

    return attachInboundContext(message, {
      messageType: "REACTION",
      direction: "INBOUND",
      emoji: getStringValue(reaction, "emoji"),
      reactedToMetaMessageId: getStringValue(reaction, "message_id"),
    });
  }

  if (message.type === "interactive") {
    return attachInboundContext(message, {
      messageType: "INTERACTIVE",
      direction: "INBOUND",
      interactive: sanitizeWhatsAppFlowPayloadForStorage(message.interactive),
    });
  }

  if (message.type === "button") {
    const button = asRecord(message.button);

    return attachInboundContext(message, {
      messageType: "BUTTON",
      direction: "INBOUND",
      payload: getStringValue(button, "payload"),
      text: getStringValue(button, "text"),
    });
  }

  const contextMetadata = getInboundContextMetadata(message);

  return Object.keys(contextMetadata).length > 0
    ? {
        direction: "INBOUND",
        ...contextMetadata,
      }
    : undefined;
}

function getInboundMessageBody(message: JsonRecord) {
  if (message.type === "text") {
    const text = asRecord(message.text);
    const body = text?.body;

    return typeof body === "string" ? body : "";
  }

  if (message.type === "button") {
    const button = asRecord(message.button);
    const text = button?.text;

    return typeof text === "string" ? text : "";
  }

  if (message.type === "interactive") {
    return JSON.stringify(sanitizeWhatsAppFlowPayloadForStorage(message.interactive));
  }

  const mediaType = getInboundMediaType(message.type);

  if (mediaType) {
    const mediaPayload = asRecord(message[String(message.type)]);
    const caption = getStringValue(mediaPayload, "caption");
    const filename = getStringValue(mediaPayload, "filename");
    const label = `${mediaType[0]}${mediaType.slice(1).toLowerCase()}`;

    return caption || filename || `[${label} received]`;
  }

  if (message.type === "location") {
    const location = asRecord(message.location);
    const name = getStringValue(location, "name");
    const address = getStringValue(location, "address");

    return [name, address].filter(Boolean).join("\n") || "[Location received]";
  }

  if (message.type === "reaction") {
    const reaction = asRecord(message.reaction);
    const emoji = getStringValue(reaction, "emoji");

    return emoji ? `Reacted ${emoji}` : "[Reaction received]";
  }

  return `[Unsupported inbound message type: ${String(message.type)}]`;
}

function getConsentKeyword(body: string) {
  const normalized = body.trim().replace(/\s+/g, " ").toUpperCase();

  if (["STOP", "UNSUBSCRIBE", "OPT OUT", "OPTOUT"].includes(normalized)) {
    return "STOP" as const;
  }

  if (["START", "SUBSCRIBE", "OPT IN", "OPTIN"].includes(normalized)) {
    return "START" as const;
  }

  return null;
}

function mapMetaStatusToMessageStatus(status: string): MessageStatus | null {
  switch (status) {
    case "sent":
      return "SENT";
    case "delivered":
      return "DELIVERED";
    case "read":
      return "READ";
    case "failed":
      return "FAILED";
    default:
      return null;
  }
}

function messageStatusRank(status: MessageStatus) {
  const ranks: Record<MessageStatus, number> = {
    CANCELED: 99,
    DELIVERED: 3,
    FAILED: 99,
    QUEUED: 1,
    RECEIVED: 0,
    RETRY_PENDING: 1,
    READ: 4,
    SENDING: 1,
    SENT: 2,
  };

  return ranks[status] ?? 0;
}

function shouldApplyMessageStatus(
  currentStatus: MessageStatus,
  nextStatus: MessageStatus,
) {
  if (currentStatus === "FAILED" || currentStatus === "CANCELED") return false;
  if (nextStatus === "FAILED") return true;

  return messageStatusRank(nextStatus) >= messageStatusRank(currentStatus);
}

const worker = new Worker<ProcessWebhookJobData>(
  "webhook-queue",
  async (job) => {
    const { webhookEventId } = job.data;

    console.log("Processing webhook job:", job.id, webhookEventId);

    const webhookEvent = await prisma.webhookEvent.findUnique({
      where: {
        id: webhookEventId,
      },
    });

    if (!webhookEvent) {
      throw new Error("Webhook event not found");
    }

    await prisma.webhookEvent.update({
      where: {
        id: webhookEvent.id,
      },
      data: {
        status: "PROCESSING",
      },
    });

    const statuses = extractStatuses(webhookEvent.payload);
    const incomingMessages = extractIncomingMessages(webhookEvent.payload);

    for (const incomingMessageValue of incomingMessages) {
      const incomingMessage = asRecord(incomingMessageValue);
      const companyId = webhookEvent.companyId;

      if (!incomingMessage) {
        continue;
      }

      if (!companyId) {
        await createUnmappedWebhookEvent({
          payload: webhookEvent.payload,
          eventType: webhookEvent.eventType,
          phoneNumberId: extractPhoneNumberId(webhookEvent.payload),
          dedupeKey: webhookEvent.dedupeKey
            ? `worker-unmapped:${webhookEvent.dedupeKey}`
            : `worker-unmapped:${webhookEvent.id}`,
          reason: "WEBHOOK_EVENT_MISSING_COMPANY_ID",
        });

        await prisma.webhookEvent.update({
          where: {
            id: webhookEvent.id,
          },
          data: {
            status: "FAILED",
          },
        });

        continue;
      }

      const metaMessageId = incomingMessage.id;
      const fromPhoneNumber = incomingMessage.from;

      if (
        typeof metaMessageId !== "string" ||
        typeof fromPhoneNumber !== "string"
      ) {
        continue;
      }

      const existingMessage = await prisma.message.findFirst({
        where: {
          companyId,
          metaMessageId,
        },
      });

      if (existingMessage) {
        continue;
      }

      const phone = splitInboundPhoneNumber(fromPhoneNumber);
      const contactName = getContactNameFromPayload(
        webhookEvent.payload,
        fromPhoneNumber,
      );
      let body = getInboundMessageBody(incomingMessage);
      const metadata = getInboundMessageMetadata(incomingMessage);
      const isFlowResponse = isWhatsAppFlowResponseMessage(incomingMessage);

      const contact = await prisma.contact.upsert({
        where: {
          companyId_phoneNumber: {
            companyId,
            phoneNumber: phone.phoneNumber,
          },
        },
        update: {
          name: contactName,
          countryCode: phone.countryCode,
          inboxStatus: "OPEN",
          inboxClosedAt: null,
          snoozedUntil: null,
        },
        create: {
          companyId,
          name: contactName,
          countryCode: phone.countryCode,
          phoneNumber: phone.phoneNumber,
          inboxStatus: "OPEN",
          inboxClosedAt: null,
          snoozedUntil: null,
        },
      });

      const message = await prisma.message.create({
        data: {
          companyId,
          contactId: contact.id,
          direction: "INBOUND",
          status: "RECEIVED",
          toPhoneNumber: fromPhoneNumber,
          body,
          variables: [],
          metaMessageId,
          metadata,
          events: {
            create: {
              companyId,
              status: "RECEIVED",
              raw: incomingMessage as Prisma.InputJsonValue,
            },
          },
        },
      });

      if (isFlowResponse) {
        try {
          const flowResponse = parseWhatsAppFlowResponse(incomingMessage);

          await recordWhatsAppFlowResponse({
            companyId,
            contactId: contact.id,
            flowToken: flowResponse.flowToken,
            inboundMessageId: message.id,
            providerMessageId: flowResponse.providerMessageId ?? metaMessageId,
            rawWebhook: incomingMessage,
            responsePayload: flowResponse.responseData,
            screenId: flowResponse.screenId,
          });
        } catch (error) {
          console.error("WHATSAPP_FLOW_RESPONSE_RECORD_ERROR:", {
            code:
              error instanceof WhatsAppFlowResponseCaptureError
                ? error.code
                : "WHATSAPP_FLOW_RESPONSE_CAPTURE_FAILED",
            companyId,
            messageId: message.id,
            providerMessageId: metaMessageId,
          });
        }
      }

      if (!isFlowResponse) {
        try {
          const catalogInteraction = await recordWhatsAppCatalogInteraction({
            companyId,
            contactId: contact.id,
            inboundMessageId: message.id,
            providerMessageId: metaMessageId,
            rawMessage: incomingMessage,
          });

          if (catalogInteraction?.body) {
            body = catalogInteraction.body;
          }
        } catch (error) {
          console.error("WHATSAPP_CATALOG_INTERACTION_RECORD_ERROR:", {
            companyId,
            contactId: contact.id,
            error: error instanceof Error ? error.message : error,
            messageId: message.id,
            providerMessageId: metaMessageId,
          });
        }
      }

      await publishInboxRealtimeEvent({
        type: "INBOUND_MESSAGE_CREATED",
        companyId,
        contactId: contact.id,
        messageId: message.id,
        body,
        createdAt: message.createdAt.toISOString(),
      }).catch((error) => {
        console.error("INBOX_REALTIME_PUBLISH_ERROR:", error);
      });

      const now = new Date();
      const consentKeyword = getConsentKeyword(body);

      await prisma.contact.update({
        where: {
          id: contact.id,
        },
        data: {
          inboxStatus: "OPEN",
          inboxClosedAt: null,
          snoozedUntil:
            consentKeyword === "STOP"
              ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000 * 10)
              : null,
          ...(consentKeyword === "STOP"
            ? {
                isBlocked: true,
                blockedAt: now,
                optedOutAt: now,
                optOutReason: `WhatsApp keyword: ${body}`,
                optOutSource: "WHATSAPP_KEYWORD",
              }
            : {}),
          ...(consentKeyword === "START"
            ? {
                isBlocked: false,
                blockedAt: null,
                optedOutAt: null,
                optOutReason: null,
                optOutSource: null,
              }
            : {}),
          inboxLastCustomerMessageAt: now,
          lastSeenAt: now,
          inboxSlaDueAt:
            consentKeyword === "STOP"
              ? null
              : calculateInboxSlaDueAt(contact.inboxPriority, now),
          inboxSlaBreachedAt: null,
          inboxSlaEscalationCount: 0,
        },
      });

      if (consentKeyword === "STOP") {
        await revokeMarketingConsent({
          companyId,
          contactId: contact.id,
          source: "WHATSAPP_KEYWORD",
          evidenceText: body,
          metadata: {
            messageId: message.id,
            keyword: body,
          },
        });
      } else if (consentKeyword === "START") {
        await grantMarketingConsent({
          companyId,
          contactId: contact.id,
          source: "WHATSAPP_KEYWORD",
          evidenceText: body,
          metadata: {
            messageId: message.id,
            keyword: body,
          },
        });
      }

      if (!isFlowResponse) {
        await processChatbotInboundMessage({
          companyId,
          contactId: contact.id,
          inboundMessageId: message.id,
        }).catch((error) => {
          console.error("CHATBOT_RUNTIME_PROCESSING_ERROR:", {
            companyId,
            contactId: contact.id,
            error: error instanceof Error ? error.message : error,
            messageId: message.id,
          });
        });

        await queueAutomationRuntimeJob({
          companyId,
          contactId: contact.id,
          inboundMessageId: message.id,
        }).catch((error) => {
          console.error("AUTOMATION_RUNTIME_QUEUE_ERROR:", {
            companyId,
            contactId: contact.id,
            error: error instanceof Error ? error.message : error,
            messageId: message.id,
          });
        });
      }

      await recordContactActivity({
        companyId,
        contactId: contact.id,
        type: "MESSAGE_INBOUND",
        title: "Customer replied",
        metadata: {
          messageId: message.id,
          metaMessageId,
        },
      });

      await attributeInboundCampaignReply({
        companyId,
        inboundMessageId: message.id,
      }).catch(() => undefined);

      await enqueueDeveloperInboundMessageWebhook(companyId, message.id);
      await queueLeadScoreRecalculation(companyId, contact.id).catch(() => undefined);
    }

    for (const statusEventValue of statuses) {
      const statusEvent = asRecord(statusEventValue);

      if (!statusEvent) {
        continue;
      }

      const metaMessageId = statusEvent?.id;
      const metaStatus = statusEvent?.status;

      if (typeof metaMessageId !== "string" || typeof metaStatus !== "string") {
        continue;
      }

      const nextStatus = mapMetaStatusToMessageStatus(metaStatus);

      if (!nextStatus) {
        continue;
      }

      const timestamp =
        typeof statusEvent.timestamp === "string" ||
        typeof statusEvent.timestamp === "number"
          ? String(statusEvent.timestamp)
          : "no_timestamp";

      const eventDedupeKey = [
        "whatsapp_status",
        metaMessageId,
        metaStatus,
        timestamp,
      ].join(":");

      const existingMessageEvent = await prisma.messageEvent.findUnique({
        where: {
          dedupeKey: eventDedupeKey,
        },
      });

      if (existingMessageEvent) {
        console.log("Duplicate message event skipped:", eventDedupeKey);
        continue;
      }

      const message = await prisma.message.findFirst({
        where: {
          metaMessageId,
        },
      });

      if (!message) {
        continue;
      }

      const shouldApplyStatus = shouldApplyMessageStatus(
        message.status,
        nextStatus,
      );

      const updatedMessage = await prisma.message.update({
        where: {
          id: message.id,
        },
        data: {
          ...(shouldApplyStatus ? { status: nextStatus } : {}),
          events: {
            create: {
              companyId: message.companyId,
              status: nextStatus,
              raw: statusEvent as Prisma.InputJsonValue,
              dedupeKey: eventDedupeKey,
            },
          },
        },
      });

      if (!shouldApplyStatus) {
        continue;
      }

      await updateBulkMessageRecipientTracking(
        updatedMessage.id,
        nextStatus,
        nextStatus === "FAILED" ? "Meta reported delivery failure" : undefined,
      );

      await enqueueDeveloperMessageStatusWebhook(
        updatedMessage.companyId,
        updatedMessage.id,
      );

      if (
        updatedMessage.campaignContactId &&
        ["SENT", "DELIVERED", "READ", "FAILED"].includes(nextStatus)
      ) {
        await prisma.campaignContact.update({
          where: {
            id: updatedMessage.campaignContactId,
          },
          data: {
            status:
              nextStatus === "SENT"
                ? "SENT"
                : nextStatus === "DELIVERED"
                ? "DELIVERED"
                : nextStatus === "READ"
                  ? "READ"
                  : "FAILED",
          },
        });
      }

      if (["SENT", "DELIVERED", "READ", "FAILED"].includes(nextStatus)) {
        await prisma.campaignLaunchRecipient.updateMany({
          where: {
            messageId: updatedMessage.id,
            status:
              nextStatus === "FAILED"
                ? { notIn: ["READ", "REPLIED"] }
                : { not: "REPLIED" },
          },
          data:
            nextStatus === "SENT"
              ? { sentAt: new Date(), status: "SENT" }
              : nextStatus === "DELIVERED"
                ? { deliveredAt: new Date(), status: "DELIVERED" }
                : nextStatus === "READ"
                  ? { readAt: new Date(), status: "READ" }
                  : {
                      failedAt: new Date(),
                      failureReason: "Meta reported delivery failure",
                      status: "FAILED",
                    },
        });
      }

      if (updatedMessage.campaignId) {
        if (nextStatus === "DELIVERED") {
          await prisma.campaign.update({
            where: {
              id: updatedMessage.campaignId,
            },
            data: {
              deliveredCount: {
                increment: 1,
              },
            },
          });
        }

        if (nextStatus === "READ") {
          await prisma.campaign.update({
            where: {
              id: updatedMessage.campaignId,
            },
            data: {
              readCount: {
                increment: 1,
              },
            },
          });
        }

        if (nextStatus === "FAILED") {
          await prisma.campaign.update({
            where: {
              id: updatedMessage.campaignId,
            },
            data: {
              failedCount: {
                increment: 1,
              },
            },
          });
        }
      }
    }

    await prisma.webhookEvent.update({
      where: {
        id: webhookEvent.id,
      },
      data: {
        status: "PROCESSED",
      },
    });

    console.log("Webhook processed:", webhookEvent.id);
  },
  {
    connection: getRedisConnection(),
  },
);

void heartbeat.start();

worker.on("completed", (job) => {
  console.log(`Webhook job completed: ${job.id}`);
});

worker.on("failed", async (job, error) => {
  console.error(`Webhook job failed: ${job?.id}`, error);
  await heartbeat.markError(error);

  if (job?.data.webhookEventId) {
    await prisma.webhookEvent.update({
      where: {
        id: job.data.webhookEventId,
      },
      data: {
        status: "FAILED",
      },
    });
  }
});

async function shutdown() {
  await worker.close();
  await heartbeat.stop();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

console.log("Webhook worker is running...");
