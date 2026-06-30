import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
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
  return components.find((component) => component.type === "BODY")?.text ?? "";
}

function extractAllTemplateVariables(components: MetaTemplateComponent[] = []) {
  const variables: string[] = [];

  for (const component of components) {
    if (component.type === "HEADER") {
      if (component.format === "TEXT" && component.text) {
        const matches = Array.from(new Set(component.text.match(/{{\d+}}/g) ?? [])).sort(
          (left, right) => Number(left.slice(2, -2)) - Number(right.slice(2, -2))
        );
        for (const m of matches) {
          const num = m.slice(2, -2);
          variables.push(`HEADER_${num}`);
        }
      } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(component.format || "")) {
        variables.push("HEADER_MEDIA");
      }
    }

    if (component.type === "BODY" && component.text) {
      const matches = Array.from(new Set(component.text.match(/{{\d+}}/g) ?? [])).sort(
        (left, right) => Number(left.slice(2, -2)) - Number(right.slice(2, -2))
      );
      for (const m of matches) {
        const num = m.slice(2, -2);
        variables.push(`BODY_${num}`);
      }
    }

    if (component.type === "BUTTONS" && Array.isArray(component.buttons)) {
      component.buttons.forEach((button, btnIdx) => {
        const btn = button as Record<string, unknown>;
        if (typeof btn.url === "string") {
          const matches = Array.from(new Set(btn.url.match(/{{\d+}}/g) ?? [])).sort(
            (left, right) => Number(left.slice(2, -2)) - Number(right.slice(2, -2))
          );
          for (const m of matches) {
            const num = m.slice(2, -2);
            variables.push(`BUTTON_${btnIdx}_${num}`);
          }
        }
      });
    }
  }

  return variables;
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

  const url = new URL(`${getMetaGraphBaseUrl()}/${wabaId}/message_templates`);
  url.searchParams.set(
    "fields",
    "id,name,language,status,category,components",
  );
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

  if (!response.ok || data.error) {
    throw new Error(getMetaTemplatesFetchErrorMessage(data, wabaId));
  }

  return data;
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
        variables: extractAllTemplateVariables(components),
        components: serializeComponents(components),
      },
      create: {
        companyId,
        metaTemplateId: template.id,
        name: template.name,
        language: template.language,
        category,
        status,
        body,
        variables: extractAllTemplateVariables(components),
        components: serializeComponents(components),
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
