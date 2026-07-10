import { prisma } from "@/lib/prisma";
import {
  applyTemplateLifecycleUpdate,
  normalizeMetaQualityScore,
  normalizeMetaRejectionReason,
  normalizeMetaTemplateCategory,
  normalizeMetaTemplateStatus,
} from "@/server/services/template-lifecycle.service";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function firstArrayItem(value: unknown) {
  return Array.isArray(value) ? value[0] : undefined;
}

function stringValue(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

export function getMetaTemplateStatusWebhookValue(payload: unknown) {
  const root = asRecord(payload);
  const entry = asRecord(firstArrayItem(root?.entry));
  const change = asRecord(firstArrayItem(entry?.changes));
  const field = stringValue(change?.field);

  if (field !== "message_template_status_update") {
    return null;
  }

  const value = asRecord(change?.value);
  if (!value) return null;

  return {
    entryId: stringValue(entry?.id),
    value,
  };
}

export async function processMetaTemplateStatusWebhook(payload: unknown) {
  const templateUpdate = getMetaTemplateStatusWebhookValue(payload);
  if (!templateUpdate) {
    return {
      handled: false,
      matched: false,
    };
  }

  const { entryId, value } = templateUpdate;
  const metaTemplateId = stringValue(
    value.message_template_id,
    value.template_id,
    value.id,
  );
  const name = stringValue(
    value.message_template_name,
    value.template_name,
    value.name,
  );
  const language = stringValue(
    value.message_template_language,
    value.language,
  );
  const rawStatus = stringValue(value.event, value.status);
  const rawCategory = stringValue(value.category);
  const rawReason = value.reason ?? value.rejected_reason ?? value.rejection_reason;
  const rawQuality = value.quality_score ?? value.quality;

  if (!metaTemplateId && (!name || !language)) {
    return {
      handled: true,
      matched: false,
      reason: "MISSING_TEMPLATE_IDENTIFIER",
    };
  }

  const account = entryId
    ? await prisma.whatsAppAccount.findFirst({
        where: {
          wabaId: entryId,
        },
        select: {
          companyId: true,
        },
      })
    : null;

  const templateLookup = [
    ...(metaTemplateId ? [{ metaTemplateId }] : []),
    ...(name && language
      ? [
          {
            name,
            language,
          },
        ]
      : []),
  ];

  const template = await prisma.template.findFirst({
    where: {
      ...(account?.companyId ? { companyId: account.companyId } : {}),
      OR: templateLookup,
    },
  });

  if (!template) {
    return {
      handled: true,
      matched: false,
      metaTemplateId,
      name,
      language,
    };
  }

  const status = normalizeMetaTemplateStatus(rawStatus, template.status);
  const category =
    normalizeMetaTemplateCategory(rawCategory) ?? template.category;
  const rejectionReason = normalizeMetaRejectionReason(rawReason);
  const qualityScore = normalizeMetaQualityScore(rawQuality);

  const updatedTemplate = await applyTemplateLifecycleUpdate({
    category,
    eventType: "WEBHOOK_STATUS_UPDATE",
    metaTemplateId: metaTemplateId ?? template.metaTemplateId,
    payload,
    qualityScore,
    rejectionReason,
    source: "META_WEBHOOK",
    status,
    template,
  });

  return {
    handled: true,
    matched: true,
    templateId: updatedTemplate.id,
    status: updatedTemplate.status,
  };
}
