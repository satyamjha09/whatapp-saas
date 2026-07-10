import crypto from "crypto";
import { MESSAGE_PRICE_PAISE } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";
import { getMessageQueue } from "@/lib/queue";
import { Prisma } from "@/generated/prisma/client";
import { assertCompanyMessageQuota } from "@/server/services/message-quota.service";
import { assertSubscriptionCanSend } from "@/server/services/subscription-expiry.service";
import {
  decryptSecret,
  encryptSecret,
} from "@/server/security/secret-encryption";
import { getWhatsAppAccessToken } from "@/server/services/whatsapp-secret.service";
import type {
  CreateWhatsAppFlowInput,
  SendTestWhatsAppFlowInput,
  UpdateWhatsAppFlowInput,
} from "@/server/validators/whatsapp-flow.validator";
import {
  isMetaNumericId,
  NUMERIC_WABA_ID_MESSAGE,
} from "@/server/whatsapp/meta-ids";

const MAX_FLOW_SYNC_PAGES = 100;
const FLOW_TOKEN_BYTES = 32;
const MAX_FLOW_RESPONSE_BYTES = Number(
  process.env.WHATSAPP_FLOW_RESPONSE_MAX_BYTES ?? 64 * 1024,
);
const MAX_FLOW_RESPONSE_DEPTH = 20;

const BLOCKED_RESPONSE_KEYS = new Set(["__proto__", "constructor", "prototype"]);
const TOKEN_RESPONSE_KEYS = new Set(["flow_token", "flowToken"]);

type RemoteWhatsAppFlow = {
  categories: unknown;
  id: string;
  metaRaw: Prisma.InputJsonValue;
  name: string;
  status: string;
  validationErrors: unknown;
};

type MetaFlowsResponse = {
  data?: unknown;
  paging?: {
    cursors?: {
      after?: unknown;
    };
    next?: unknown;
  };
  error?: {
    code?: number;
    message?: string;
    type?: string;
  };
};

export type FlowTemplateRuntimeConfig = {
  action: "navigate" | "data_exchange";
  buttonText: string;
  localFlowId: string;
  metaFlowId: string;
  navigateScreen: string | null;
};

export class WhatsAppFlowSyncError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "WhatsAppFlowSyncError";
    this.code = code;
    this.status = status;
  }
}

export class WhatsAppFlowResponseCaptureError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "WhatsAppFlowResponseCaptureError";
    this.code = code;
  }
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactStringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function safeJsonByteLength(value: Prisma.InputJsonValue) {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

function inputJsonNull() {
  return Prisma.JsonNull as unknown as Prisma.InputJsonValue;
}

function sanitizeFlowJsonValue(
  value: unknown,
  options: { stripTokenKeys?: boolean } = {},
  depth = 0,
): Prisma.InputJsonValue {
  if (depth > MAX_FLOW_RESPONSE_DEPTH) return inputJsonNull();

  if (value === null) return inputJsonNull();

  if (typeof value === "string" || typeof value === "boolean") {
    return value as Prisma.InputJsonValue;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : inputJsonNull();
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      sanitizeFlowJsonValue(item, options, depth + 1),
    ) as Prisma.InputJsonArray;
  }

  if (!isRecord(value)) return inputJsonNull();

  const output: Record<string, Prisma.InputJsonValue> = {};

  for (const [key, childValue] of Object.entries(value)) {
    if (BLOCKED_RESPONSE_KEYS.has(key)) continue;
    if (options.stripTokenKeys && TOKEN_RESPONSE_KEYS.has(key)) continue;

    if (options.stripTokenKeys && key === "response_json" && typeof childValue === "string") {
      try {
        output[key] = sanitizeFlowJsonValue(
          JSON.parse(childValue) as unknown,
          options,
          depth + 1,
        );
        continue;
      } catch {
        output[key] = childValue;
        continue;
      }
    }

    output[key] = sanitizeFlowJsonValue(childValue, options, depth + 1);
  }

  return output as Prisma.InputJsonObject;
}

function assertResponseSize(value: Prisma.InputJsonValue) {
  if (safeJsonByteLength(value) > MAX_FLOW_RESPONSE_BYTES) {
    throw new WhatsAppFlowResponseCaptureError(
      "FLOW_RESPONSE_TOO_LARGE",
      "WhatsApp Flow response is too large to capture safely.",
    );
  }
}

export function sanitizeWhatsAppFlowPayloadForStorage(value: unknown) {
  return sanitizeFlowJsonValue(value, { stripTokenKeys: true });
}

export function isWhatsAppFlowResponseMessage(message: unknown) {
  const record = isRecord(message) ? message : null;
  const interactive = isRecord(record?.interactive) ? record.interactive : null;

  return record?.type === "interactive" && interactive?.type === "nfm_reply";
}

export function parseWhatsAppFlowResponse(message: unknown) {
  if (!isWhatsAppFlowResponseMessage(message)) {
    throw new WhatsAppFlowResponseCaptureError(
      "FLOW_RESPONSE_NOT_FOUND",
      "WhatsApp message is not a Flow response.",
    );
  }

  const record = message as Record<string, unknown>;
  const interactive = record.interactive as Record<string, unknown>;
  const nfmReply = isRecord(interactive.nfm_reply)
    ? interactive.nfm_reply
    : null;

  if (!nfmReply) {
    throw new WhatsAppFlowResponseCaptureError(
      "FLOW_RESPONSE_NOT_FOUND",
      "WhatsApp Flow response payload is missing.",
    );
  }

  const flowToken = exactStringValue(nfmReply.flow_token);

  if (!flowToken) {
    throw new WhatsAppFlowResponseCaptureError(
      "FLOW_TOKEN_MISSING",
      "WhatsApp Flow response token is missing.",
    );
  }

  const responseJson = nfmReply.response_json;
  let parsedResponse: unknown;

  if (typeof responseJson === "string") {
    try {
      parsedResponse = JSON.parse(responseJson) as unknown;
    } catch {
      throw new WhatsAppFlowResponseCaptureError(
        "FLOW_RESPONSE_INVALID_JSON",
        "WhatsApp Flow response JSON is invalid.",
      );
    }
  } else {
    parsedResponse = responseJson ?? {};
  }

  if (!isRecord(parsedResponse)) {
    throw new WhatsAppFlowResponseCaptureError(
      "FLOW_RESPONSE_INVALID_JSON",
      "WhatsApp Flow response JSON must be an object.",
    );
  }

  const responseData = sanitizeFlowJsonValue(parsedResponse, {
    stripTokenKeys: true,
  });

  assertResponseSize(responseData);

  return {
    flowToken,
    providerMessageId: exactStringValue(record.id) || null,
    responseData,
    screenId:
      exactStringValue(nfmReply.screen_id) ||
      exactStringValue(nfmReply.screen) ||
      null,
  };
}

function getMetaGraphBaseUrl() {
  const version = process.env.WHATSAPP_API_VERSION ?? "v25.0";

  return `https://graph.facebook.com/${version}`;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRemoteStatus(value: unknown) {
  return stringValue(value).toUpperCase() || "UNKNOWN";
}

function statusForLocalEnum(remoteStatus: string) {
  if (remoteStatus === "PUBLISHED") return "PUBLISHED";
  if (remoteStatus === "DRAFT") return "DRAFT";
  if (remoteStatus === "DEPRECATED") return "DEPRECATED";
  return "DISABLED";
}

export function isFlowUsableForTemplate(flow: {
  isUsableForTemplates?: boolean | null;
  metaFlowId?: string | null;
  remoteMissingAt?: Date | string | null;
  remoteStatus?: string | null;
  status?: string | null;
}) {
  return Boolean(
    flow.isUsableForTemplates &&
      flow.metaFlowId &&
      !flow.remoteMissingAt &&
      normalizeRemoteStatus(flow.remoteStatus ?? flow.status) === "PUBLISHED",
  );
}

export function createWhatsAppFlowToken() {
  return crypto.randomBytes(FLOW_TOKEN_BYTES).toString("base64url");
}

export function hashWhatsAppFlowToken(flowToken: string) {
  return crypto.createHash("sha256").update(flowToken, "utf8").digest("hex");
}

export function encryptWhatsAppFlowToken(flowToken: string) {
  return encryptSecret({
    plaintext: flowToken,
    purpose: "whatsapp_flow_token",
  });
}

export function decryptWhatsAppFlowToken(encryptedFlowToken: string) {
  return decryptSecret({
    encrypted: encryptedFlowToken,
    purpose: "whatsapp_flow_token",
  });
}

export function readFlowTemplateRuntimeConfig(
  components: Prisma.JsonValue | null | undefined,
): FlowTemplateRuntimeConfig | null {
  if (!isRecord(components) || components.templateType !== "FLOWS") {
    return null;
  }

  const flow = components.flow;
  if (!isRecord(flow)) return null;

  const localFlowId = stringValue(flow.localFlowId);
  const metaFlowId = stringValue(flow.metaFlowId);

  if (!localFlowId || !metaFlowId) return null;

  const action = stringValue(flow.action).toLowerCase();

  return {
    action: action === "data_exchange" ? "data_exchange" : "navigate",
    buttonText: stringValue(flow.buttonText) || "Open form",
    localFlowId,
    metaFlowId,
    navigateScreen: stringValue(flow.navigateScreen) || null,
  };
}

export async function getFlowInteractionRuntimeForMessage({
  companyId,
  messageId,
}: {
  companyId: string;
  messageId: string;
}) {
  const interaction = await prisma.whatsAppFlowInteraction.findFirst({
    where: {
      companyId,
      messageId,
    },
    select: {
      flowTokenEncrypted: true,
      id: true,
      metaFlowId: true,
      status: true,
    },
  });

  if (!interaction) {
    throw new Error("Flow interaction not found for this message");
  }

  if (interaction.status === "FAILED" || interaction.status === "COMPLETED") {
    throw new Error("Flow interaction is no longer sendable");
  }

  await prisma.whatsAppFlowInteraction.update({
    where: { id: interaction.id },
    data: {
      failedAt: null,
      lastError: null,
      status: "SENDING",
    },
  });

  return {
    flowToken: decryptWhatsAppFlowToken(interaction.flowTokenEncrypted),
    id: interaction.id,
    metaFlowId: interaction.metaFlowId,
  };
}

export async function markFlowInteractionSent({
  companyId,
  messageId,
  metaMessageId,
}: {
  companyId: string;
  messageId: string;
  metaMessageId: string;
}) {
  await prisma.whatsAppFlowInteraction.updateMany({
    where: {
      companyId,
      messageId,
      status: {
        not: "COMPLETED",
      },
    },
    data: {
      failedAt: null,
      lastError: null,
      metaMessageId,
      sentAt: new Date(),
      status: "SENT",
    },
  });
}

export async function markFlowInteractionFailed({
  companyId,
  messageId,
  reason,
}: {
  companyId: string;
  messageId: string;
  reason: string;
}) {
  await prisma.whatsAppFlowInteraction.updateMany({
    where: {
      companyId,
      messageId,
      status: {
        not: "COMPLETED",
      },
    },
    data: {
      failedAt: new Date(),
      lastError: reason,
      status: "FAILED",
    },
  });
}

function getMetaFlowError(data: MetaFlowsResponse, fallback: string) {
  const message = data.error?.message;
  if (!message) return fallback;

  return message;
}

function classifyMetaFlowError(data: MetaFlowsResponse, status: number) {
  if (status === 401) {
    return new WhatsAppFlowSyncError(
      "FLOW_SYNC_META_UNAUTHORIZED",
      "Meta rejected the WhatsApp access token.",
      401,
    );
  }

  if (status === 403) {
    return new WhatsAppFlowSyncError(
      "FLOW_SYNC_META_FORBIDDEN",
      "This WhatsApp account does not have permission to read Flows.",
      403,
    );
  }

  if (status === 429) {
    return new WhatsAppFlowSyncError(
      "FLOW_SYNC_META_RATE_LIMITED",
      "Meta rate limited the Flow sync request. Please try again later.",
      429,
    );
  }

  return new WhatsAppFlowSyncError(
    "FLOW_SYNC_META_FAILED",
    getMetaFlowError(data, "Unable to fetch WhatsApp Flows from Meta."),
    status >= 400 ? status : 400,
  );
}

function readRemoteFlow(value: unknown): RemoteWhatsAppFlow | null {
  if (!isRecord(value)) return null;

  const id = stringValue(value.id);
  if (!id) return null;

  return {
    categories: Array.isArray(value.categories) ? value.categories : [],
    id,
    metaRaw: safeJson({
      categories: Array.isArray(value.categories) ? value.categories : undefined,
      data_api_version: value.data_api_version,
      id,
      json_version: value.json_version,
      name: stringValue(value.name) || id,
      status: normalizeRemoteStatus(value.status),
      validation_errors: value.validation_errors,
    }),
    name: stringValue(value.name) || `Flow ${id}`,
    status: normalizeRemoteStatus(value.status),
    validationErrors: value.validation_errors ?? [],
  };
}

function readMetaFlowsResponse(data: MetaFlowsResponse) {
  if (!isRecord(data) || !Array.isArray(data.data)) {
    throw new WhatsAppFlowSyncError(
      "FLOW_SYNC_RESPONSE_INVALID",
      "Meta returned an invalid Flow sync response.",
      502,
    );
  }

  const flows = data.data
    .map(readRemoteFlow)
    .filter((flow): flow is RemoteWhatsAppFlow => Boolean(flow));
  const after = data.paging?.next ? stringValue(data.paging.cursors?.after) : "";

  return {
    after: after || null,
    flows,
  };
}

async function fetchRemoteFlowPage({
  accessToken,
  after,
  wabaId,
}: {
  accessToken: string;
  after?: string;
  wabaId: string;
}) {
  async function fetchWithFields(fields: string) {
    const url = new URL(`${getMetaGraphBaseUrl()}/${wabaId}/flows`);
    url.searchParams.set("fields", fields);
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      method: "GET",
    });
    const data = (await response.json()) as MetaFlowsResponse;

    return {
      data,
      ok: response.ok && !data.error,
      status: response.status,
    };
  }

  const extendedFields =
    "id,name,status,categories,validation_errors,json_version,data_api_version";
  let result = await fetchWithFields(extendedFields);

  if (!result.ok) {
    const message = result.data.error?.message?.toLowerCase() ?? "";
    const fieldUnavailable =
      message.includes("nonexisting field") ||
      message.includes("unknown field") ||
      message.includes("cannot query field");

    if (fieldUnavailable) {
      result = await fetchWithFields("id,name,status");
    }
  }

  if (!result.ok) {
    throw classifyMetaFlowError(result.data, result.status);
  }

  return readMetaFlowsResponse(result.data);
}

export async function listRemoteWhatsAppFlows({
  accessToken,
  wabaId,
}: {
  accessToken: string;
  wabaId: string;
}) {
  if (!isMetaNumericId(wabaId)) {
    throw new WhatsAppFlowSyncError(
      "FLOW_SYNC_WABA_MISSING",
      NUMERIC_WABA_ID_MESSAGE,
      400,
    );
  }

  const flows: RemoteWhatsAppFlow[] = [];
  const seenCursors = new Set<string>();
  let after: string | undefined;

  for (let page = 0; page < MAX_FLOW_SYNC_PAGES; page += 1) {
    const result = await fetchRemoteFlowPage({ accessToken, after, wabaId });
    flows.push(...result.flows);

    if (!result.after || seenCursors.has(result.after)) {
      return flows;
    }

    seenCursors.add(result.after);
    after = result.after;
  }

  throw new WhatsAppFlowSyncError(
    "FLOW_SYNC_RESPONSE_INVALID",
    "Meta Flow pagination did not finish safely.",
    502,
  );
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

export async function getUsableWhatsAppFlowsForCompany(companyId: string) {
  return prisma.whatsAppFlow.findMany({
    where: {
      companyId,
      isUsableForTemplates: true,
      metaFlowId: {
        not: "",
      },
      remoteMissingAt: null,
    },
    orderBy: {
      name: "asc",
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
          receivedAt: "desc",
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
      remoteStatus: input.status,
      name: input.name,
      schema: safeJson(input.schema),
      status: input.status,
      isUsableForTemplates: input.status === "PUBLISHED",
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
      isUsableForTemplates:
        input.status === undefined ? undefined : input.status === "PUBLISHED",
      metaFlowId: input.metaFlowId,
      name: input.name,
      remoteMissingAt: input.status === "PUBLISHED" ? null : undefined,
      remoteStatus: input.status,
      schema:
        input.schema === undefined ? undefined : safeJson(input.schema),
      status: input.status,
      useCase: input.useCase,
    },
  });
}

export async function syncWhatsAppFlowsForCompany(companyId: string) {
  const account = await prisma.whatsAppAccount.findFirst({
    where: {
      companyId,
      status: "CONNECTED",
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!account) {
    throw new WhatsAppFlowSyncError(
      "WHATSAPP_NOT_CONNECTED",
      "Connect WhatsApp before syncing Flows.",
      400,
    );
  }

  if (!account.wabaId) {
    throw new WhatsAppFlowSyncError(
      "FLOW_SYNC_WABA_MISSING",
      "Connected WhatsApp account is missing a WABA ID.",
      400,
    );
  }

  if (!account.accessToken) {
    throw new WhatsAppFlowSyncError(
      "FLOW_SYNC_TOKEN_MISSING",
      "Connected WhatsApp account is missing an access token.",
      400,
    );
  }

  const accessToken = await getWhatsAppAccessToken({ companyId });
  const remoteFlows = await listRemoteWhatsAppFlows({
    accessToken,
    wabaId: account.wabaId,
  });
  const now = new Date();
  const remoteIds = new Set(remoteFlows.map((flow) => flow.id));
  let created = 0;
  let updated = 0;
  let usableForTemplates = 0;

  for (const remoteFlow of remoteFlows) {
    const existing = await prisma.whatsAppFlow.findUnique({
      where: {
        companyId_metaFlowId: {
          companyId,
          metaFlowId: remoteFlow.id,
        },
      },
      select: {
        id: true,
      },
    });
    const status = statusForLocalEnum(remoteFlow.status);
    const isUsable = remoteFlow.status === "PUBLISHED";

    if (isUsable) usableForTemplates += 1;

    await prisma.whatsAppFlow.upsert({
      where: {
        companyId_metaFlowId: {
          companyId,
          metaFlowId: remoteFlow.id,
        },
      },
      update: {
        categories: safeJson(remoteFlow.categories),
        isUsableForTemplates: isUsable,
        lastSyncedAt: now,
        metaRaw: remoteFlow.metaRaw,
        name: remoteFlow.name,
        remoteMissingAt: null,
        remoteStatus: remoteFlow.status,
        status,
        validationErrors: safeJson(remoteFlow.validationErrors),
        whatsAppAccountId: account.id,
      },
      create: {
        categories: safeJson(remoteFlow.categories),
        companyId,
        defaultCta: "Open form",
        isUsableForTemplates: isUsable,
        lastSyncedAt: now,
        metaFlowId: remoteFlow.id,
        metaRaw: remoteFlow.metaRaw,
        name: remoteFlow.name,
        remoteStatus: remoteFlow.status,
        status,
        validationErrors: safeJson(remoteFlow.validationErrors),
        whatsAppAccountId: account.id,
      },
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  const missingResult = await prisma.whatsAppFlow.updateMany({
    where: {
      companyId,
      ...(remoteIds.size > 0
        ? {
            metaFlowId: {
              notIn: [...remoteIds],
            },
          }
        : {}),
      remoteMissingAt: null,
      whatsAppAccountId: account.id,
    },
    data: {
      isUsableForTemplates: false,
      remoteMissingAt: now,
    },
  });

  return {
    ok: true,
    summary: {
      created,
      markedMissing: missingResult.count,
      remoteFound: remoteFlows.length,
      unchanged: Math.max(remoteFlows.length - created - updated, 0),
      updated,
      usableForTemplates,
    },
    syncedAt: now.toISOString(),
  };
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
      isUsableForTemplates: true,
      remoteMissingAt: null,
    },
  });

  if (!flow) {
    throw new Error("Flow not found or not published");
  }

  if (!isFlowUsableForTemplate(flow)) {
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
  await assertSubscriptionCanSend(companyId);
  await assertCompanyMessageQuota(companyId);

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
  providerMessageId,
  rawWebhook,
  responsePayload,
  screenId,
}: {
  companyId: string;
  contactId?: string | null;
  flowToken: string;
  inboundMessageId?: string | null;
  providerMessageId?: string | null;
  rawWebhook?: unknown;
  responsePayload: unknown;
  screenId?: string | null;
}) {
  if (!flowToken) {
    throw new WhatsAppFlowResponseCaptureError(
      "FLOW_TOKEN_MISSING",
      "WhatsApp Flow response token is missing.",
    );
  }

  const flowTokenHash = hashWhatsAppFlowToken(flowToken);
  const responseData = sanitizeFlowJsonValue(responsePayload, {
    stripTokenKeys: true,
  });
  const sanitizedRawWebhook = sanitizeFlowJsonValue(rawWebhook, {
    stripTokenKeys: true,
  });

  assertResponseSize(responseData);
  assertResponseSize(sanitizedRawWebhook);

  const interaction = await prisma.whatsAppFlowInteraction.findUnique({
    where: {
      flowTokenHash,
    },
    select: {
      contactId: true,
      companyId: true,
      completedAt: true,
      flowAssetId: true,
      id: true,
      message: {
        select: {
          campaignId: true,
          id: true,
        },
      },
      messageId: true,
      metaFlowId: true,
      status: true,
      templateId: true,
    },
  });

  if (!interaction) {
    throw new WhatsAppFlowResponseCaptureError(
      "FLOW_INTERACTION_NOT_FOUND",
      "WhatsApp Flow interaction could not be matched.",
    );
  }

  if (interaction.companyId !== companyId) {
    throw new WhatsAppFlowResponseCaptureError(
      "FLOW_INTERACTION_TENANT_MISMATCH",
      "WhatsApp Flow response tenant does not match the receiving account.",
    );
  }

  if (contactId && interaction.contactId !== contactId) {
    throw new WhatsAppFlowResponseCaptureError(
      "FLOW_INTERACTION_CONTACT_MISMATCH",
      "WhatsApp Flow response sender does not match the original interaction.",
    );
  }

  const receivedAt = new Date();
  const existingResponse = await prisma.whatsAppFlowResponse.findUnique({
    where: {
      flowInteractionId: interaction.id,
    },
  });

  if (existingResponse) {
    if (existingResponse.status === "CAPTURED") {
      const { enqueueWhatsAppFlowResponseProcessing } = await import(
        "@/server/services/whatsapp-flow-response-mapping.service"
      );

      await enqueueWhatsAppFlowResponseProcessing({
        flowResponseId: existingResponse.id,
      });
    }

    return existingResponse;
  }

  const response = await prisma.$transaction(async (tx) => {
    const response = await tx.whatsAppFlowResponse.create({
      data: {
        campaignId: interaction.message?.campaignId ?? null,
        companyId,
        contactId: interaction.contactId,
        flowId: interaction.flowAssetId,
        flowInteractionId: interaction.id,
        flowTokenHash,
        messageId: inboundMessageId ?? null,
        providerMessageId: providerMessageId || null,
        rawWebhook: sanitizedRawWebhook,
        receivedAt,
        responseData,
        responsePayload: responseData,
        screenId: screenId || null,
        status: "CAPTURED",
      },
    });

    await tx.whatsAppFlowInteraction.updateMany({
      where: {
        id: interaction.id,
        status: {
          not: "COMPLETED",
        },
      },
      data: {
        completedAt: receivedAt,
        failedAt: null,
        lastError: null,
        status: "COMPLETED",
      },
    });

    return response;
  });

  const { enqueueWhatsAppFlowResponseProcessing } = await import(
    "@/server/services/whatsapp-flow-response-mapping.service"
  );

  await enqueueWhatsAppFlowResponseProcessing({
    flowResponseId: response.id,
  });

  return response;
}
