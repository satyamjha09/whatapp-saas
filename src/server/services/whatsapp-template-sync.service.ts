import type { Prisma } from "@/generated/prisma/client";
import { decryptText } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";

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

function extractTemplateVariables(body: string) {
  return Array.from(new Set(body.match(/{{\d+}}/g) ?? [])).sort(
    (left, right) => {
      return Number(left.slice(2, -2)) - Number(right.slice(2, -2));
    },
  );
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

async function fetchMetaTemplatePage({
  accessToken,
  after,
  wabaId,
}: {
  accessToken: string;
  after?: string;
  wabaId: string;
}) {
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
    throw new Error(data.error?.message ?? "Unable to fetch WhatsApp templates");
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

  const accessToken = decryptText(account.accessToken);
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

  for (const template of templates) {
    const status = normalizeTemplateStatus(template.status);
    const category = normalizeTemplateCategory(template.category);

    if (!status || !category) {
      skippedCount += 1;
      continue;
    }

    const components = template.components ?? [];
    const body = extractTemplateBody(components);

    await prisma.template.upsert({
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
        variables: extractTemplateVariables(body),
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
        variables: extractTemplateVariables(body),
        components: serializeComponents(components),
      },
    });

    syncedCount += 1;
  }

  return {
    fetchedCount: templates.length,
    syncedCount,
    skippedCount,
  };
}
