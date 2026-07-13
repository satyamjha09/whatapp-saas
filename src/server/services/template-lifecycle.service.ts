import type { Prisma, Template, TemplateCategory, TemplateStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type TemplateLifecycleSource =
  | "APP"
  | "META_SUBMIT"
  | "META_SYNC"
  | "META_WEBHOOK"
  | "SYSTEM";

export function normalizeMetaTemplateStatus(
  status?: string | null,
  fallback: TemplateStatus = "PENDING_APPROVAL",
): TemplateStatus {
  switch (status?.toUpperCase()) {
    case "APPROVED":
      return "APPROVED";
    case "PENDING":
    case "PENDING_APPROVAL":
    case "IN_REVIEW":
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
    case "REINSTATED":
      return "REINSTATED";
    case "SUBMITTING":
      return "SUBMITTING";
    case "DRAFT":
      return "DRAFT";
    default:
      return fallback;
  }
}

export function normalizeMetaTemplateCategory(
  category?: string | null,
): TemplateCategory | null {
  switch (category?.toUpperCase()) {
    case "MARKETING":
      return "MARKETING";
    case "UTILITY":
      return "UTILITY";
    case "AUTHENTICATION":
      return "AUTHENTICATION";
    default:
      return null;
  }
}

export function normalizeMetaQualityScore(value: unknown) {
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

export function normalizeMetaRejectionReason(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.toUpperCase() === "NONE") {
    return null;
  }

  return trimmed;
}

export async function recordTemplateLifecycleEvent({
  actorUserId,
  companyId,
  eventType,
  metaTemplateId,
  newCategory,
  newStatus,
  payload,
  previousCategory,
  previousStatus,
  qualityScore,
  reason,
  source,
  templateId,
}: {
  actorUserId?: string | null;
  companyId: string;
  eventType: string;
  metaTemplateId?: string | null;
  newCategory?: string | null;
  newStatus?: string | null;
  payload?: unknown;
  previousCategory?: string | null;
  previousStatus?: string | null;
  qualityScore?: string | null;
  reason?: string | null;
  source: TemplateLifecycleSource;
  templateId: string;
}) {
  return prisma.templateLifecycleEvent.create({
    data: {
      actorUserId: actorUserId ?? null,
      companyId,
      eventType,
      metaTemplateId: metaTemplateId ?? null,
      newCategory: newCategory ?? null,
      newStatus: newStatus ?? null,
      payload:
        payload === undefined
          ? undefined
          : (JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue),
      previousCategory: previousCategory ?? null,
      previousStatus: previousStatus ?? null,
      qualityScore: qualityScore ?? null,
      reason: reason ?? null,
      source,
      templateId,
    },
  });
}

export async function applyTemplateLifecycleUpdate({
  actorUserId,
  category,
  eventType,
  metaTemplateId,
  payload,
  qualityScore,
  rejectionReason,
  source,
  status,
  template,
}: {
  actorUserId?: string | null;
  category?: TemplateCategory | null;
  eventType: string;
  metaTemplateId?: string | null;
  payload?: unknown;
  qualityScore?: string | null;
  rejectionReason?: string | null;
  source: TemplateLifecycleSource;
  status?: TemplateStatus | null;
  template: Template;
}) {
  const nextStatus = status ?? template.status;
  const nextCategory = category ?? template.category;
  const now = new Date();
  const changed =
    nextStatus !== template.status ||
    nextCategory !== template.category ||
    (metaTemplateId ?? template.metaTemplateId) !== template.metaTemplateId ||
    (qualityScore ?? null) !== (template.qualityScore ?? null) ||
    (rejectionReason ?? null) !== (template.rejectionReason ?? null);

  const updatedTemplate = await prisma.template.update({
    where: { id: template.id },
    data: {
      category: nextCategory,
      status: nextStatus,
      ...(metaTemplateId !== undefined ? { metaTemplateId } : {}),
      ...(qualityScore !== undefined ? { qualityScore } : {}),
      ...(rejectionReason !== undefined ? { rejectionReason } : {}),
      lastSyncedAt: source === "META_SYNC" || source === "META_WEBHOOK" ? now : template.lastSyncedAt,
      ...(nextStatus === "APPROVED" && !template.approvedAt
        ? { approvedAt: now }
        : {}),
    },
  });

  if (changed || source === "META_WEBHOOK") {
    await recordTemplateLifecycleEvent({
      actorUserId,
      companyId: template.companyId,
      eventType,
      metaTemplateId: metaTemplateId ?? template.metaTemplateId,
      newCategory: nextCategory,
      newStatus: nextStatus,
      payload,
      previousCategory: template.category,
      previousStatus: template.status,
      qualityScore,
      reason: rejectionReason,
      source,
      templateId: template.id,
    });
  }

  return updatedTemplate;
}

export async function getTemplateLifecycleEvents(companyId: string, templateId: string) {
  return prisma.templateLifecycleEvent.findMany({
    where: {
      companyId,
      templateId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}
