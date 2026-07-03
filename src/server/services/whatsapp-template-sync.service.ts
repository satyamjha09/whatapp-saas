import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  readTemplateComponents,
  serializeTemplateVariables,
} from "@/lib/whatsapp-template/template-variable-parser";
import {
  assertUsageQuotaAvailable,
  incrementUsageQuota,
} from "@/server/services/usage-quota.service";
import { getWhatsAppAccessToken } from "@/server/services/whatsapp-secret.service";
import {
  isMetaNumericId,
  NUMERIC_WABA_ID_MESSAGE,
} from "@/server/whatsapp/meta-ids";

type MetaTemplateComponent = {
  type: string;
  format?: string;
  text?: string;
  example?: unknown;
  buttons?: unknown[];
};

type MetaTemplate = {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
  components?: MetaTemplateComponent[];
  quality_score?: unknown;
  rejected_reason?: unknown;
  rejection_reason?: unknown;
};

type MetaTemplatesResponse = {
  data?: MetaTemplate[];
  paging?: {
    cursors?: {
      after?: string;
    };
    next?: string;
  };
  error?: {
    message?: string;
  };
};

type TemplateStatus =
  | "APPROVED"
  | "PENDING_APPROVAL"
  | "REJECTED"
  | "PAUSED"
  | "IN_APPEAL"
  | "PENDING_DELETION"
  | "DELETED"
  | "DISABLED"
  | "LIMIT_EXCEEDED";

type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

function getMetaGraphBaseUrl() {
  const version = process.env.WHATSAPP_API_VERSION ?? "v25.0";

  return `https://graph.facebook.com/${version}`;
}

function extractTemplateBody(components: MetaTemplateComponent[] = []) {
  return (
    readTemplateComponents({ components }).find(
      (component) => component.type?.toUpperCase() === "BODY",
    )?.text ?? ""
  );
}

function normalizeQualityScore(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const score = (value as { score?: unknown }).score;
    if (typeof score === "string" && score.trim().length > 0) {
      return score.trim();
    }
  }

  return null;
}

function normalizeRejectionReason(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.toUpperCase() === "NONE") {
    return null;
  }

  return trimmed;
}

function normalizeTemplateStatus(status: string): TemplateStatus | null {
  switch (status.toUpperCase()) {
    case "APPROVED":
      return "APPROVED";
    case "PENDING":
    case "PENDING_APPROVAL":
      return "PENDING_APPROVAL";
    case "REJECTED":
      return "REJECTED";
    case "PAUSED":
      return "PAUSED";
    case "IN_APPEAL":
      return "IN_APPEAL";
    case "PENDING_DELETION":
      return "PENDING_DELETION";
    case "DELETED":
      return "DELETED";
    case "DISABLED":
      return "DISABLED";
    case "LIMIT_EXCEEDED":
      return "LIMIT_EXCEEDED";
    default:
      return null;
  }
}

function normalizeTemplateCategory(category: string): TemplateCategory | null {
  const normalized = category.toUpperCase();

  if (
    normalized === "MARKETING" ||
    normalized === "UTILITY" ||
    normalized === "AUTHENTICATION"
  ) {
    return normalized;
  }

  return null;
}

function serializeComponents(
  components: MetaTemplateComponent[],
): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(components)) as Prisma.InputJsonValue;
}

function getMetaTemplatesFetchErrorMessage(
  data: MetaTemplatesResponse,
  wabaId: string,
) {
  const message = data.error?.message;

  if (!message) {
    return "Unable to fetch WhatsApp templates";
  }

  if (message.toLowerCase().includes("unsupported get request")) {
    return `Meta rejected WABA ID "${wabaId}". Confirm the WABA ID is a real numeric WhatsApp Business Account ID and that this access token has permission for that WABA.`;
  }

  return message;
}

async function fetchMetaTemplatePage({
  accessToken,
  after,
  wabaId,
}: {
  accessToken: string;
  after?: string;
  wabaId: string;
}) {
  if (!isMetaNumericId(wabaId)) {
    throw new Error(NUMERIC_WABA_ID_MESSAGE);
  }

  async function fetchWithFields(fields: string) {
    const url = new URL(`${getMetaGraphBaseUrl()}/${wabaId}/message_templates`);
    url.searchParams.set("fields", fields);
    url.searchParams.set("limit", "100");

    if (after) url.searchParams.set("after", after);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });
    const data = (await response.json()) as MetaTemplatesResponse;

    return {
      data,
      ok: response.ok && !data.error,
    };
  }

  const extendedFields =
    "id,name,language,status,category,components,quality_score,rejected_reason,rejection_reason";
  let result = await fetchWithFields(extendedFields);

  if (!result.ok) {
    const message = result.data.error?.message?.toLowerCase() ?? "";
    const fieldUnavailable =
      message.includes("nonexisting field") ||
      message.includes("unknown field") ||
      message.includes("cannot query field");

    if (fieldUnavailable) {
      result = await fetchWithFields("id,name,language,status,category,components");
    }
  }

  if (!result.ok) {
    throw new Error(getMetaTemplatesFetchErrorMessage(result.data, wabaId));
  }

  return result.data;
}

export async function syncWhatsAppTemplatesFromMeta(companyId: string) {
  const account = await prisma.whatsAppAccount.findFirst({
    where: {
      companyId,
      status: "CONNECTED",
    },
    orderBy: { createdAt: "asc" },
  });

  if (!account?.wabaId || !account.accessToken) {
    throw new Error("WhatsApp account is not connected");
  }

  const accessToken = await getWhatsAppAccessToken({ companyId });
  const templates: MetaTemplate[] = [];
  const seenCursors = new Set<string>();
  let after: string | undefined;

  do {
    const page = await fetchMetaTemplatePage({
      accessToken,
      after,
      wabaId: account.wabaId,
    });
    templates.push(...(page.data ?? []));
    const nextCursor = page.paging?.next
      ? page.paging.cursors?.after
      : undefined;

    if (!nextCursor || seenCursors.has(nextCursor)) {
      after = undefined;
    } else {
      seenCursors.add(nextCursor);
      after = nextCursor;
    }
  } while (after);

  let syncedCount = 0;
  let skippedCount = 0;
  const syncableTemplates = [];

  for (const template of templates) {
    const status = normalizeTemplateStatus(template.status);
    const category = normalizeTemplateCategory(template.category);

    if (!status || !category) {
      skippedCount += 1;
      continue;
    }

    syncableTemplates.push({
      template,
      status,
      category,
    });
  }

  if (syncableTemplates.length === 0) {
    return {
      fetchedCount: templates.length,
      syncedCount,
      skippedCount,
    };
  }

  const existingTemplateKeys = new Set(
    (
      await prisma.template.findMany({
        where: {
          companyId,
          OR: syncableTemplates.map(({ template }) => ({
            name: template.name,
            language: template.language,
          })),
        },
        select: {
          name: true,
          language: true,
        },
      })
    ).map((template) => `${template.name}:${template.language}`),
  );

  const newTemplateCount = syncableTemplates.filter(({ template }) => {
    return !existingTemplateKeys.has(`${template.name}:${template.language}`);
  }).length;

  await assertUsageQuotaAvailable({
    companyId,
    featureKey: "TEMPLATES",
    amount: newTemplateCount,
  });

  for (const { template, status, category } of syncableTemplates) {
    const isNewTemplate = !existingTemplateKeys.has(
      `${template.name}:${template.language}`,
    );
    const components = template.components ?? [];
    const body = extractTemplateBody(components);
    const variables = serializeTemplateVariables({ body, components });
    const qualityScore = normalizeQualityScore(template.quality_score);
    const rejectionReason = normalizeRejectionReason(
      template.rejected_reason ?? template.rejection_reason,
    );

    const syncedTemplate = await prisma.template.upsert({
      where: {
        companyId_name_language: {
          companyId,
          name: template.name,
          language: template.language,
        },
      },
      update: {
        metaTemplateId: template.id,
        category,
        status,
        body,
        variables,
        components: serializeComponents(components),
        lastSyncedAt: new Date(),
        qualityScore,
        rejectionReason,
      },
      create: {
        companyId,
        metaTemplateId: template.id,
        name: template.name,
        language: template.language,
        category,
        status,
        body,
        variables,
        components: serializeComponents(components),
        lastSyncedAt: new Date(),
        qualityScore,
        rejectionReason,
      },
    });

    if (isNewTemplate) {
      await incrementUsageQuota({
        companyId,
        featureKey: "TEMPLATES",
        amount: 1,
        idempotencyKey: `template-created:${syncedTemplate.id}`,
        reason: "template-created",
        metadata: {
          templateId: syncedTemplate.id,
          source: "whatsapp-template-sync",
        },
      });
    }

    syncedCount += 1;
  }

  return {
    fetchedCount: templates.length,
    syncedCount,
    skippedCount,
  };
}
