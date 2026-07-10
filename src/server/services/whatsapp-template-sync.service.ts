import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildStoredTemplateComponents,
  buildTemplateVariableKeys,
  type TemplateType,
} from "@/lib/whatsapp-template/template-definition";
import { readTemplateComponents } from "@/lib/whatsapp-template/template-variable-parser";
import {
  assertUsageQuotaAvailable,
  incrementUsageQuota,
} from "@/server/services/usage-quota.service";
import {
  normalizeMetaQualityScore,
  normalizeMetaRejectionReason,
  normalizeMetaTemplateCategory,
  normalizeMetaTemplateStatus,
  recordTemplateLifecycleEvent,
} from "@/server/services/template-lifecycle.service";
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

function serializeComponents(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function inferTemplateTypeFromMetaComponents(
  components: MetaTemplateComponent[],
): TemplateType {
  const hasCarousel = components.some((component) => {
    const type = component.type.toUpperCase();
    return type === "CAROUSEL" || type === "CARDS";
  });

  if (hasCarousel) return "CAROUSEL";

  const header = components.find(
    (component) => component.type.toUpperCase() === "HEADER",
  );
  const headerFormat = header?.format?.toUpperCase();

  if (
    headerFormat === "IMAGE" ||
    headerFormat === "VIDEO" ||
    headerFormat === "DOCUMENT"
  ) {
    return "MEDIA";
  }

  return "STANDARD";
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
    const status = normalizeMetaTemplateStatus(template.status);
    const category = normalizeMetaTemplateCategory(template.category);

    if (!category) {
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
    const templateType = inferTemplateTypeFromMetaComponents(components);
    const storedComponents = buildStoredTemplateComponents({
      body,
      components: {
        components,
        templateType,
      },
      templateType,
    });
    const variables = buildTemplateVariableKeys({
      body,
      components: storedComponents,
    });
    const qualityScore = normalizeMetaQualityScore(template.quality_score);
    const rejectionReason = normalizeMetaRejectionReason(
      template.rejected_reason ?? template.rejection_reason,
    );
    const now = new Date();
    const approvedAt = status === "APPROVED" ? now : null;
    const existingTemplate = await prisma.template.findUnique({
      where: {
        companyId_name_language: {
          companyId,
          name: template.name,
          language: template.language,
        },
      },
    });

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
        components: serializeComponents(storedComponents),
        lastSyncedAt: now,
        qualityScore,
        rejectionReason,
        ...(approvedAt ? { approvedAt } : {}),
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
        components: serializeComponents(storedComponents),
        lastSyncedAt: now,
        qualityScore,
        rejectionReason,
        approvedAt,
      },
    });

    await recordTemplateLifecycleEvent({
      companyId,
      eventType: existingTemplate ? "SYNCED_FROM_META" : "IMPORTED_FROM_META",
      metaTemplateId: template.id,
      newCategory: category,
      newStatus: status,
      payload: template,
      previousCategory: existingTemplate?.category,
      previousStatus: existingTemplate?.status,
      qualityScore,
      reason: rejectionReason,
      source: "META_SYNC",
      templateId: syncedTemplate.id,
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
