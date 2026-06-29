import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/server/services/audit.service";
import { redactSensitiveData } from "@/server/utils/safe-logger";
import type { CampaignContactStatus } from "@/generated/prisma/enums";

export class ContactSegmentBuilderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContactSegmentBuilderError";
  }
}

export type SegmentRuleInput = {
  field:
    | "PHONE"
    | "NAME"
    | "EMAIL"
    | "SOURCE"
    | "CITY"
    | "TAG"
    | "MARKETING_CONSENT"
    | "UTILITY_CONSENT"
    | "CREATED_AT"
    | "LAST_MESSAGE_AT"
    | "CUSTOM_FIELD"
    | "CAMPAIGN_OUTCOME";
  operator:
    | "EQUALS"
    | "NOT_EQUALS"
    | "CONTAINS"
    | "NOT_CONTAINS"
    | "STARTS_WITH"
    | "ENDS_WITH"
    | "IN"
    | "NOT_IN"
    | "EXISTS"
    | "NOT_EXISTS"
    | "BEFORE"
    | "AFTER"
    | "BETWEEN";
  customFieldKey?: string | null;
  value?: string | null;
  values?: unknown;
};

type CampaignOutcomeRuleValues = {
  campaignId?: unknown;
  replyCondition?: unknown;
  statuses?: unknown;
};

function isEnabled() {
  return process.env.SEGMENT_BUILDER_ENABLED !== "false";
}

function maxRules() {
  const value = Number(process.env.SEGMENT_BUILDER_MAX_RULES ?? 25);
  return Number.isFinite(value) && value > 0 ? value : 25;
}

function maxPreviewContacts() {
  const value = Number(process.env.SEGMENT_BUILDER_MAX_PREVIEW_CONTACTS ?? 1000);
  return Number.isFinite(value) && value > 0 ? value : 1000;
}

function safeJson(value: unknown): Prisma.InputJsonValue {
  return redactSensitiveData(value) as Prisma.InputJsonValue;
}

function clean(value?: string | null) {
  return String(value ?? "").trim();
}

function values(rule: SegmentRuleInput) {
  return Array.isArray(rule.values)
    ? rule.values.map((value) => clean(value)).filter(Boolean)
    : [];
}

function stringCondition(operator: SegmentRuleInput["operator"], value?: string | null) {
  const cleaned = clean(value);

  if (operator === "EQUALS") return { equals: cleaned, mode: "insensitive" as const };
  if (operator === "NOT_EQUALS") return { not: cleaned, mode: "insensitive" as const };
  if (operator === "CONTAINS") return { contains: cleaned, mode: "insensitive" as const };
  if (operator === "NOT_CONTAINS") return { not: { contains: cleaned, mode: "insensitive" as const } };
  if (operator === "STARTS_WITH") return { startsWith: cleaned, mode: "insensitive" as const };
  if (operator === "ENDS_WITH") return { endsWith: cleaned, mode: "insensitive" as const };
  if (operator === "EXISTS") return { not: null };
  if (operator === "NOT_EXISTS") return null;

  return { contains: cleaned, mode: "insensitive" as const };
}

function enumCondition(rule: SegmentRuleInput) {
  const cleaned = clean(rule.value);
  const list = values(rule);

  if (rule.operator === "IN") return { in: list };
  if (rule.operator === "NOT_IN") return { notIn: list };
  if (rule.operator === "NOT_EQUALS") return { not: cleaned };

  return cleaned;
}

function dateCondition(rule: SegmentRuleInput) {
  const cleaned = clean(rule.value);
  const list = values(rule);

  if (rule.operator === "BEFORE") return { lt: new Date(cleaned) };
  if (rule.operator === "AFTER") return { gt: new Date(cleaned) };
  if (rule.operator === "BETWEEN") return { gte: new Date(list[0]), lte: new Date(list[1]) };
  if (rule.operator === "EXISTS") return { not: null };
  if (rule.operator === "NOT_EXISTS") return null;

  return undefined;
}

function campaignOutcomeWhere(
  companyId: string,
  rawValues: unknown,
): Prisma.ContactWhereInput {
  const ruleValues =
    rawValues && typeof rawValues === "object"
      ? (rawValues as CampaignOutcomeRuleValues)
      : {};
  const campaignId =
    typeof ruleValues.campaignId === "string"
      ? ruleValues.campaignId.trim()
      : "";
  const statuses = Array.isArray(ruleValues.statuses)
    ? ruleValues.statuses
        .filter((status): status is CampaignContactStatus =>
          ["SENT", "DELIVERED", "READ", "FAILED", "SKIPPED"].includes(
            String(status),
          ),
        )
    : [];
  const replyCondition =
    ruleValues.replyCondition === "REPLIED" ||
    ruleValues.replyCondition === "NOT_REPLIED"
      ? ruleValues.replyCondition
      : "ANY";

  if (!campaignId || statuses.length === 0) {
    throw new ContactSegmentBuilderError(
      "Invalid campaign outcome segment rule.",
    );
  }

  const where: Prisma.ContactWhereInput = {
    isBlocked: false,
    marketingConsentStatus: {
      not: "REVOKED",
    },
    campaignContacts: {
      some: {
        campaignId,
        companyId,
        status: {
          in: statuses,
        },
      },
    },
  };

  if (replyCondition === "REPLIED") {
    where.campaignReplyAttributions = {
      some: {
        campaignId,
        companyId,
        status: "ATTRIBUTED",
      },
    };
  }

  if (replyCondition === "NOT_REPLIED") {
    where.campaignReplyAttributions = {
      none: {
        campaignId,
        companyId,
        status: "ATTRIBUTED",
      },
    };
  }

  return where;
}

function buildContactWhereFromRule(
  companyId: string,
  rule: SegmentRuleInput,
): Prisma.ContactWhereInput {
  const list = values(rule);

  if (rule.field === "PHONE") return { phoneNumber: stringCondition(rule.operator, rule.value) } as Prisma.ContactWhereInput;
  if (rule.field === "NAME") return { name: stringCondition(rule.operator, rule.value) } as Prisma.ContactWhereInput;
  if (rule.field === "EMAIL") return { email: stringCondition(rule.operator, rule.value) } as Prisma.ContactWhereInput;
  if (rule.field === "SOURCE") return { source: stringCondition(rule.operator, rule.value) } as Prisma.ContactWhereInput;
  if (rule.field === "MARKETING_CONSENT") return { marketingConsentStatus: enumCondition(rule) } as Prisma.ContactWhereInput;
  if (rule.field === "UTILITY_CONSENT") return { utilityConsentStatus: enumCondition(rule) } as Prisma.ContactWhereInput;
  if (rule.field === "CREATED_AT") return { createdAt: dateCondition(rule) } as Prisma.ContactWhereInput;
  if (rule.field === "LAST_MESSAGE_AT") return { lastRepliedAt: dateCondition(rule) } as Prisma.ContactWhereInput;
  if (rule.field === "CAMPAIGN_OUTCOME") return campaignOutcomeWhere(companyId, rule.values);
  if (rule.field === "TAG") {
    return {
      inboxTags: {
        some: {
          tag: {
            name: rule.operator === "IN" ? { in: list, mode: "insensitive" } : stringCondition(rule.operator, rule.value),
          },
        },
      },
    } as Prisma.ContactWhereInput;
  }

  throw new ContactSegmentBuilderError(`${rule.field} segment rules are not supported by the current contact schema.`);
}

function buildSegmentWhere(input: {
  companyId: string;
  matchMode: "ALL" | "ANY";
  rules: SegmentRuleInput[];
}): Prisma.ContactWhereInput {
  const ruleWhere = input.rules.map((rule) =>
    buildContactWhereFromRule(input.companyId, rule),
  );

  return {
    companyId: input.companyId,
    ...(ruleWhere.length === 0 ? {} : input.matchMode === "ALL" ? { AND: ruleWhere } : { OR: ruleWhere }),
  };
}

function normalizeRules(rules: { field: string; operator: string; customFieldKey: string | null; value: string | null; values: Prisma.JsonValue }[]) {
  return rules.map((rule) => ({
    field: rule.field as SegmentRuleInput["field"],
    operator: rule.operator as SegmentRuleInput["operator"],
    customFieldKey: rule.customFieldKey,
    value: rule.value,
    values: Array.isArray(rule.values)
      ? rule.values.map(String)
      : rule.values && typeof rule.values === "object"
        ? rule.values
        : [],
  }));
}

export async function createContactSegment(input: {
  companyId: string;
  actorUserId?: string | null;
  name: string;
  description?: string | null;
  matchMode: "ALL" | "ANY";
  rules: SegmentRuleInput[];
}) {
  if (!isEnabled()) throw new ContactSegmentBuilderError("Segment Builder is disabled.");
  if (!input.name.trim()) throw new ContactSegmentBuilderError("Segment name is required.");
  if (input.rules.length > maxRules()) throw new ContactSegmentBuilderError(`Segment cannot exceed ${maxRules()} rules.`);

  const segment = await prisma.$transaction(async (tx) => {
    const created = await tx.contactSegment.create({
      data: {
        companyId: input.companyId,
        createdByUserId: input.actorUserId ?? null,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        matchMode: input.matchMode,
      },
    });

    await tx.contactSegmentRule.createMany({
      data: input.rules.map((rule) => ({
        companyId: input.companyId,
        segmentId: created.id,
        field: rule.field,
        operator: rule.operator,
        customFieldKey: rule.customFieldKey ?? null,
        value: rule.value ?? null,
        values: rule.values ? safeJson(rule.values) : Prisma.JsonNull,
      })),
    });

    return created;
  });

  await createAuditLog({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    action: "contact.segment_created",
    entityType: "ContactSegment",
    entityId: segment.id,
    metadata: safeJson({ name: input.name, matchMode: input.matchMode, ruleCount: input.rules.length }),
  }).catch(() => undefined);

  return segment;
}

export async function updateContactSegment(input: {
  companyId: string;
  segmentId: string;
  actorUserId?: string | null;
  name?: string | null;
  description?: string | null;
  status?: "ACTIVE" | "DISABLED";
  matchMode?: "ALL" | "ANY";
  rules?: SegmentRuleInput[];
}) {
  if (input.rules && input.rules.length > maxRules()) throw new ContactSegmentBuilderError(`Segment cannot exceed ${maxRules()} rules.`);

  const existing = await prisma.contactSegment.findFirst({
    where: { id: input.segmentId, companyId: input.companyId },
    include: { rules: true },
  });

  if (!existing) throw new ContactSegmentBuilderError("Segment not found.");

  const updated = await prisma.$transaction(async (tx) => {
    const segment = await tx.contactSegment.update({
      where: { id: existing.id },
      data: {
        name: input.name?.trim() || existing.name,
        description: input.description === undefined ? existing.description : input.description?.trim() || null,
        status: input.status ?? existing.status,
        matchMode: input.matchMode ?? existing.matchMode,
      },
    });

    if (input.rules) {
      await tx.contactSegmentRule.deleteMany({ where: { segmentId: existing.id, companyId: input.companyId } });
      await tx.contactSegmentRule.createMany({
        data: input.rules.map((rule) => ({
          companyId: input.companyId,
          segmentId: existing.id,
          field: rule.field,
          operator: rule.operator,
          customFieldKey: rule.customFieldKey ?? null,
          value: rule.value ?? null,
          values: rule.values ? safeJson(rule.values) : Prisma.JsonNull,
        })),
      });
    }

    return segment;
  });

  await createAuditLog({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    action: "contact.segment_updated",
    entityType: "ContactSegment",
    entityId: existing.id,
    metadata: safeJson({ ruleCount: input.rules?.length ?? existing.rules.length }),
  }).catch(() => undefined);

  return updated;
}

export async function previewContactSegment(input: {
  companyId: string;
  segmentId: string;
  actorUserId?: string | null;
}) {
  const segment = await prisma.contactSegment.findFirst({
    where: { id: input.segmentId, companyId: input.companyId, status: "ACTIVE" },
    include: { rules: true },
  });

  if (!segment) throw new ContactSegmentBuilderError("Active segment not found.");

  const where = buildSegmentWhere({
    companyId: input.companyId,
    matchMode: segment.matchMode,
    rules: normalizeRules(segment.rules),
  });

  const [totalMatched, sampleContacts] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        countryCode: true,
        email: true,
        source: true,
        marketingConsentStatus: true,
        utilityConsentStatus: true,
        createdAt: true,
      },
      take: maxPreviewContacts(),
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const preview = await prisma.contactSegmentPreview.create({
    data: {
      companyId: input.companyId,
      segmentId: segment.id,
      generatedByUserId: input.actorUserId ?? null,
      totalMatched,
      sampleCount: sampleContacts.length,
      sampleContactIds: safeJson(sampleContacts.map((contact) => contact.id)),
      sampleContacts: safeJson(
        sampleContacts.slice(0, 25).map((contact) => ({
          id: contact.id,
          name: contact.name,
          phoneLast4: contact.phoneNumber.slice(-4),
          email: contact.email,
          source: contact.source,
          marketingConsentStatus: contact.marketingConsentStatus,
          utilityConsentStatus: contact.utilityConsentStatus,
        })),
      ),
    },
  });

  await prisma.contactSegment.update({
    where: { id: segment.id },
    data: { lastPreviewCount: totalMatched, lastPreviewAt: new Date() },
  });

  return { segment, preview, sampleContacts };
}

export async function getSegmentContactsForCampaign(input: {
  companyId: string;
  segmentId: string;
  limit?: number;
}) {
  const segment = await prisma.contactSegment.findFirst({
    where: { id: input.segmentId, companyId: input.companyId, status: "ACTIVE" },
    include: { rules: true },
  });

  if (!segment) throw new ContactSegmentBuilderError("Active segment not found.");

  const where = buildSegmentWhere({
    companyId: input.companyId,
    matchMode: segment.matchMode,
    rules: normalizeRules(segment.rules),
  });

  return prisma.contact.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      countryCode: true,
      phoneNumber: true,
      source: true,
      companyName: true,
      lifecycleStage: true,
      marketingConsentStatus: true,
      utilityConsentStatus: true,
      isBlocked: true,
      createdAt: true,
      lastRepliedAt: true,
    },
    take: input.limit ?? maxPreviewContacts(),
    orderBy: { createdAt: "desc" },
  });
}

export async function listContactSegments(input: { companyId: string }) {
  return prisma.contactSegment.findMany({
    where: { companyId: input.companyId },
    include: {
      rules: true,
      createdByUser: { select: { id: true, name: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}

export async function getContactSegmentBuilderHealth() {
  const [activeSegments, disabledSegments, previews24h] = await Promise.all([
    prisma.contactSegment.count({ where: { status: "ACTIVE" } }),
    prisma.contactSegment.count({ where: { status: "DISABLED" } }),
    prisma.contactSegmentPreview.count({
      where: { generatedAt: { gte: new Date(Date.now() - 86_400_000) } },
    }),
  ]);

  return {
    enabled: isEnabled(),
    activeSegments,
    disabledSegments,
    previews24h,
    isHealthy: isEnabled(),
  };
}
