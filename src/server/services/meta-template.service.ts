import type { TemplateStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";
import { getWhatsAppAccessToken } from "@/server/services/whatsapp-secret.service";
import { syncWhatsAppTemplatesFromMeta } from "@/server/services/whatsapp-template-sync.service";

type MetaTemplateComponent = {
  type: string;
  format?: string;
  text?: string;
  example?: unknown;
  buttons?: unknown[];
  cards?: unknown[];
};

type MetaTemplateSubmitResponse = {
  id?: string;
  status?: string;
  category?: string;
  error?: {
    message?: string;
  };
};

function getMetaGraphBaseUrl() {
  const version = process.env.WHATSAPP_API_VERSION ?? "v25.0";

  return `https://graph.facebook.com/${version}`;
}

function normalizeTemplateStatus(status?: string | null): TemplateStatus {
  switch (status?.toUpperCase()) {
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
      return "PENDING_APPROVAL";
  }
}

function isMetaComponent(value: unknown): value is MetaTemplateComponent {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>).type === "string"
  );
}

function getStoredMetaComponents(components: unknown) {
  if (Array.isArray(components) && components.every(isMetaComponent)) {
    return components;
  }

  if (
    components &&
    typeof components === "object" &&
    !Array.isArray(components)
  ) {
    const record = components as Record<string, unknown>;

    if (
      Array.isArray(record.components) &&
      record.components.every(isMetaComponent)
    ) {
      return record.components;
    }
  }

  return null;
}

function buildMetaComponents({
  body,
  components,
}: {
  body: string;
  components: unknown;
}) {
  return (
    getStoredMetaComponents(components) ?? [
      {
        type: "BODY",
        text: body,
      },
    ]
  );
}

async function submitTemplateToMeta({
  accessToken,
  body,
  category,
  components,
  language,
  name,
  wabaId,
}: {
  accessToken: string;
  body: string;
  category: string;
  components: unknown;
  language: string;
  name: string;
  wabaId: string;
}) {
  const response = await fetch(
    `${getMetaGraphBaseUrl()}/${wabaId}/message_templates`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        language,
        category,
        components: buildMetaComponents({ body, components }),
      }),
      cache: "no-store",
    },
  );
  const data = (await response.json()) as MetaTemplateSubmitResponse;

  if (!response.ok || data.error) {
    throw new Error(data.error?.message ?? "Unable to submit template to Meta");
  }

  return data;
}

export async function submitTemplateForMetaApproval({
  actorUserId,
  companyId,
  templateId,
}: {
  actorUserId: string;
  companyId: string;
  templateId: string;
}) {
  const [template, account] = await Promise.all([
    prisma.template.findFirst({
      where: {
        id: templateId,
        companyId,
      },
    }),
    prisma.whatsAppAccount.findFirst({
      where: {
        companyId,
        status: "CONNECTED",
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
  ]);

  if (!template) {
    throw new Error("Template not found");
  }

  if (!["DRAFT", "REJECTED"].includes(template.status)) {
    throw new Error("Only draft or rejected templates can be submitted");
  }

  if (!account?.wabaId || !account.accessToken) {
    throw new Error("WhatsApp account is not connected");
  }

  const accessToken = await getWhatsAppAccessToken({ companyId });
  const result = await submitTemplateToMeta({
    accessToken,
    body: template.body,
    category: template.category,
    components: template.components,
    language: template.language,
    name: template.name,
    wabaId: account.wabaId,
  });
  const status = normalizeTemplateStatus(result.status);

  const updatedTemplate = await prisma.template.update({
    where: {
      id: template.id,
    },
    data: {
      metaTemplateId: result.id ?? template.metaTemplateId,
      status,
    },
  });

  await createAuditLog({
    companyId,
    actorUserId,
    action: "template.submitted_to_meta",
    entityType: "Template",
    entityId: template.id,
    metadata: {
      metaTemplateId: updatedTemplate.metaTemplateId,
      status: updatedTemplate.status,
    },
  }).catch(() => undefined);

  return updatedTemplate;
}

export async function syncPendingTemplateStatusesFromMeta() {
  const companyRows = await prisma.template.findMany({
    where: {
      status: {
        in: ["PENDING_APPROVAL", "IN_APPEAL", "PAUSED"],
      },
    },
    distinct: ["companyId"],
    select: {
      companyId: true,
    },
  });

  const results = [];

  for (const row of companyRows) {
    try {
      const result = await syncWhatsAppTemplatesFromMeta(row.companyId);
      results.push({
        companyId: row.companyId,
        ok: true,
        ...result,
      });
    } catch (error) {
      results.push({
        companyId: row.companyId,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
}
