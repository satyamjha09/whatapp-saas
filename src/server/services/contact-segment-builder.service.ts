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
    | "COMPANY_NAME"
    | "SOURCE"
    | "CITY"
    | "TAG"
    | "OPTED_OUT"
    | "MARKETING_CONSENT"
    | "UTILITY_CONSENT"
    | "CREATED_AT"
    | "LAST_MESSAGE_AT"
    | "CUSTOM_FIELD"
    | "CAMPAIGN_OUTCOME"
    | "LEAD_SCORE";
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
    | "BETWEEN"
    | "GREATER_THAN"
    | "LESS_THAN"
    | "IN_LAST_DAYS"
    | "NOT_IN_LAST_DAYS"
    | "IS_TRUE"
    | "IS_FALSE";
  customFieldKey?: string | null;
  value?: string | null;
  values?: unknown;
};

export const SEGMENT_FIELD_OPERATORS: Record<
  SegmentRuleInput["field"],
  SegmentRuleInput["operator"][]
> = {
  PHONE: ["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_CONTAINS", "STARTS_WITH", "ENDS_WITH"],
  NAME: ["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_CONTAINS", "STARTS_WITH", "ENDS_WITH", "EXISTS", "NOT_EXISTS"],
  EMAIL: ["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_CONTAINS", "STARTS_WITH", "ENDS_WITH", "EXISTS", "NOT_EXISTS"],
  COMPANY_NAME: ["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_CONTAINS", "STARTS_WITH", "ENDS_WITH", "EXISTS", "NOT_EXISTS"],
  SOURCE: ["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_CONTAINS"],
  CITY: ["EQUALS", "NOT_EQUALS", "CONTAINS", "NOT_CONTAINS", "EXISTS", "NOT_EXISTS"],
  TAG: ["CONTAINS", "NOT_CONTAINS", "EQUALS", "IN", "EXISTS", "NOT_EXISTS"],
  OPTED_OUT: ["IS_TRUE", "IS_FALSE"],
  MARKETING_CONSENT: ["EQUALS", "NOT_EQUALS", "IN", "NOT_IN"],
  UTILITY_CONSENT: ["EQUALS", "NOT_EQUALS", "IN", "NOT_IN"],
  CREATED_AT: ["BEFORE", "AFTER", "BETWEEN", "IN_LAST_DAYS", "NOT_IN_LAST_DAYS"],
  LAST_MESSAGE_AT: ["BEFORE", "AFTER", "BETWEEN", "IN_LAST_DAYS", "NOT_IN_LAST_DAYS", "EXISTS", "NOT_EXISTS"],
  CUSTOM_FIELD: ["EQUALS", "NOT_EQUALS", "CONTAINS", "EXISTS", "NOT_EXISTS"],
  CAMPAIGN_OUTCOME: ["EQUALS"],
  LEAD_SCORE: ["EQUALS", "GREATER_THAN", "LESS_THAN", "BETWEEN"],
};

const VALUELESS_OPERATORS = new Set<SegmentRuleInput["operator"]>([
  "EXISTS",
  "NOT_EXISTS",
  "IS_TRUE",
  "IS_FALSE",
]);

const CUSTOM_FIELD_KEY_PATTERN = /^[a-zA-Z0-9_.-]{1,60}$/;

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
  if (rule.operator === "IN_LAST_DAYS") {
    return { gte: new Date(Date.now() - Number(cleaned) * 86_400_000) };
  }
  if (rule.operator === "NOT_IN_LAST_DAYS") {
    return { lt: new Date(Date.now() - Number(cleaned) * 86_400_000) };
  }
  if (rule.operator === "EXISTS") return { not: null };
  if (rule.operator === "NOT_EXISTS") return null;

  return undefined;
}

function customFieldWhere(rule: SegmentRuleInput): Prisma.ContactWhereInput {
  const key = clean(rule.customFieldKey);

  if (!CUSTOM_FIELD_KEY_PATTERN.test(key)) {
    throw new ContactSegmentBuilderError(
      "Custom field rules need a key (letters, numbers, dot, dash, underscore).",
    );
  }

  const cleaned = clean(rule.value);

  if (rule.operator === "EQUALS") {
    return { customAttributes: { path: [key], equals: cleaned } };
  }

  if (rule.operator === "NOT_EQUALS") {
    return { NOT: [{ customAttributes: { path: [key], equals: cleaned } }] };
  }

  if (rule.operator === "CONTAINS") {
    return { customAttributes: { path: [key], string_contains: cleaned } };
  }

  if (rule.operator === "EXISTS") {
    return { customAttributes: { path: [key], not: Prisma.AnyNull } };
  }

  if (rule.operator === "NOT_EXISTS") {
    return { NOT: [{ customAttributes: { path: [key], not: Prisma.AnyNull } }] };
  }

  throw new ContactSegmentBuilderError(
    `Unsupported custom field operator: ${rule.operator}`,
  );
}

function tagWhere(rule: SegmentRuleInput, list: string[]): Prisma.ContactWhereInput {
  if (rule.operator === "EXISTS") {
    return { inboxTags: { some: {} } };
  }

  if (rule.operator === "NOT_EXISTS") {
    return { inboxTags: { none: {} } };
  }

  if (rule.operator === "NOT_CONTAINS") {
    return {
      inboxTags: {
        none: {
          tag: { name: { contains: clean(rule.value), mode: "insensitive" } },
        },
      },
    };
  }

  return {
    inboxTags: {
      some: {
        tag: {
          name:
            rule.operator === "IN"
              ? { in: list, mode: "insensitive" }
              : stringCondition(rule.operator, rule.value),
        },
      },
    },
  } as Prisma.ContactWhereInput;
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

function leadScoreWhere(rule: SegmentRuleInput): Prisma.ContactWhereInput {
  const numericValue = Number(rule.value);
  if (rule.operator === "EQUALS") {
    return {
      leadScore: numericValue,
    };
  }
  if (rule.operator === "GREATER_THAN") {
    return {
      leadScore: {
        gt: numericValue,
      },
    };
  }
  if (rule.operator === "LESS_THAN") {
    return {
      leadScore: {
        lt: numericValue,
      },
    };
  }
  if (rule.operator === "BETWEEN") {
    const valuesList = Array.isArray(rule.values) ? rule.values : [];
    const min = Number(valuesList[0]);
    const max = Number(valuesList[1]);
    return {
      leadScore: {
        gte: min,
        lte: max,
      },
    };
  }
  throw new ContactSegmentBuilderError(`Unsupported lead score segment operator: ${rule.operator}`);
}

function buildContactWhereFromRule(
  companyId: string,
  rule: SegmentRuleInput,
): Prisma.ContactWhereInput {
  const list = values(rule);

  if (rule.field === "PHONE") return { phoneNumber: stringCondition(rule.operator, rule.value) } as Prisma.ContactWhereInput;
  if (rule.field === "NAME") return { name: stringCondition(rule.operator, rule.value) } as Prisma.ContactWhereInput;
  if (rule.field === "EMAIL") return { email: stringCondition(rule.operator, rule.value) } as Prisma.ContactWhereInput;
  if (rule.field === "COMPANY_NAME") return { companyName: stringCondition(rule.operator, rule.value) } as Prisma.ContactWhereInput;
  if (rule.field === "CITY") return { city: stringCondition(rule.operator, rule.value) } as Prisma.ContactWhereInput;
  if (rule.field === "SOURCE") return { source: stringCondition(rule.operator, rule.value) } as Prisma.ContactWhereInput;
  if (rule.field === "OPTED_OUT") {
    return rule.operator === "IS_TRUE"
      ? { optedOutAt: { not: null } }
      : { optedOutAt: null };
  }
  if (rule.field === "MARKETING_CONSENT") return { marketingConsentStatus: enumCondition(rule) } as Prisma.ContactWhereInput;
  if (rule.field === "UTILITY_CONSENT") return { utilityConsentStatus: enumCondition(rule) } as Prisma.ContactWhereInput;
  if (rule.field === "CREATED_AT") return { createdAt: dateCondition(rule) } as Prisma.ContactWhereInput;
  if (rule.field === "LAST_MESSAGE_AT") {
    if (rule.operator === "NOT_IN_LAST_DAYS") {
      // "Not messaged in the last N days" includes contacts who never replied.
      return {
        OR: [
          { lastRepliedAt: null },
          { lastRepliedAt: dateCondition(rule) },
        ],
      } as Prisma.ContactWhereInput;
    }

    return { lastRepliedAt: dateCondition(rule) } as Prisma.ContactWhereInput;
  }
  if (rule.field === "CUSTOM_FIELD") return customFieldWhere(rule);
  if (rule.field === "CAMPAIGN_OUTCOME") return campaignOutcomeWhere(companyId, rule.values);
  if (rule.field === "LEAD_SCORE") return leadScoreWhere(rule);
  if (rule.field === "TAG") return tagWhere(rule, list);

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

function validateRules(rules: SegmentRuleInput[]) {
  for (const rule of rules) {
    const allowedOperators = SEGMENT_FIELD_OPERATORS[rule.field];

    if (!allowedOperators) {
      throw new ContactSegmentBuilderError(`Unsupported segment field: ${rule.field}`);
    }

    if (!allowedOperators.includes(rule.operator)) {
      throw new ContactSegmentBuilderError(
        `Operator ${rule.operator} is not allowed for ${rule.field}.`,
      );
    }

    if (rule.field === "CUSTOM_FIELD" && !CUSTOM_FIELD_KEY_PATTERN.test(clean(rule.customFieldKey))) {
      throw new ContactSegmentBuilderError(
        "Custom field rules need a key (letters, numbers, dot, dash, underscore).",
      );
    }

    if (
      !VALUELESS_OPERATORS.has(rule.operator) &&
      rule.field !== "CAMPAIGN_OUTCOME"
    ) {
      if (rule.operator === "BETWEEN") {
        if (values(rule).length !== 2) {
          throw new ContactSegmentBuilderError(
            `${rule.field} BETWEEN operator requires exactly two values.`,
          );
        }
      } else if (rule.operator === "IN" || rule.operator === "NOT_IN") {
        if (values(rule).length === 0) {
          throw new ContactSegmentBuilderError(
            `${rule.field} ${rule.operator} operator requires at least one value.`,
          );
        }
      } else if (!clean(rule.value)) {
        throw new ContactSegmentBuilderError(
          `${rule.field} ${rule.operator} rule requires a value.`,
        );
      }
    }

    if (rule.operator === "IN_LAST_DAYS" || rule.operator === "NOT_IN_LAST_DAYS") {
      const days = Number(clean(rule.value));

      if (!Number.isFinite(days) || days < 1 || days > 3650) {
        throw new ContactSegmentBuilderError(
          "Day-based rules require a number of days between 1 and 3650.",
        );
      }
    }

    if (rule.operator === "BEFORE" || rule.operator === "AFTER") {
      if (Number.isNaN(new Date(clean(rule.value)).getTime())) {
        throw new ContactSegmentBuilderError(
          `${rule.field} ${rule.operator} rule requires a valid date.`,
        );
      }
    }

    if (rule.field === "LEAD_SCORE") {
      const allowedOps = ["EQUALS", "GREATER_THAN", "LESS_THAN", "BETWEEN"];
      if (!allowedOps.includes(rule.operator)) {
        throw new ContactSegmentBuilderError(`Lead score field only supports operators: ${allowedOps.join(", ")}`);
      }
      if (rule.operator === "BETWEEN") {
        const valuesList = Array.isArray(rule.values) ? rule.values : [];
        if (valuesList.length !== 2) {
          throw new ContactSegmentBuilderError("Lead score BETWEEN operator requires exactly two values.");
        }
        const min = Number(valuesList[0]);
        const max = Number(valuesList[1]);
        if (Number.isNaN(min) || Number.isNaN(max)) {
          throw new ContactSegmentBuilderError("Lead score BETWEEN operator values must be numeric.");
        }
        if (min < 0 || max < 0 || min > 1000 || max > 1000) {
          throw new ContactSegmentBuilderError("Lead score BETWEEN values must be between 0 and 1000.");
        }
        if (min > max) {
          throw new ContactSegmentBuilderError("Lead score BETWEEN min value cannot be greater than max value.");
        }
      } else {
        const val = Number(rule.value);
        if (Number.isNaN(val)) {
          throw new ContactSegmentBuilderError("Lead score operator value must be numeric.");
        }
        if (val < 0 || val > 1000) {
          throw new ContactSegmentBuilderError("Lead score value must be between 0 and 1000.");
        }
      }
    }
  }
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
  validateRules(input.rules);

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
  if (input.rules) validateRules(input.rules);

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

/* -------------------------------------------------------------------------
 * Import & Broadcast Suite - Phase 16B additions
 * ------------------------------------------------------------------------- */

// TODO: Replace with plan-based entitlements once segment limits are added to
// the plan gating system.
function maxSegmentsPerCompany() {
  const value = Number(process.env.CONTACT_SEGMENTS_MAX_PER_COMPANY ?? 100);
  return Number.isFinite(value) && value > 0 ? value : 100;
}

export function validateSegmentRules(input: {
  matchMode: "ALL" | "ANY";
  rules: SegmentRuleInput[];
}) {
  if (!["ALL", "ANY"].includes(input.matchMode)) {
    throw new ContactSegmentBuilderError("Match mode must be ALL or ANY.");
  }

  if (input.rules.length > maxRules()) {
    throw new ContactSegmentBuilderError(`Segment cannot exceed ${maxRules()} rules.`);
  }

  validateRules(input.rules);
}

export async function assertSegmentLimit(companyId: string) {
  const total = await prisma.contactSegment.count({ where: { companyId } });

  if (total >= maxSegmentsPerCompany()) {
    throw new ContactSegmentBuilderError(
      `Company cannot have more than ${maxSegmentsPerCompany()} segments.`,
    );
  }
}

function segmentWarnings(rules: SegmentRuleInput[], totalMatched: number) {
  const warnings: string[] = [];

  const excludesOptedOut = rules.some(
    (rule) => rule.field === "OPTED_OUT" && rule.operator === "IS_FALSE",
  );

  if (!excludesOptedOut) {
    warnings.push(
      "This segment may include opted-out contacts. Broadcasts exclude them automatically.",
    );
  }

  if (rules.length === 0) {
    warnings.push("Segment has no rules and will include all contacts.");
  }

  if (totalMatched === 0) {
    warnings.push("No contacts currently match this segment.");
  }

  return warnings;
}

/**
 * Ad-hoc preview for unsaved rules (used by the segment builder live count).
 */
export async function previewSegmentRules(input: {
  companyId: string;
  matchMode: "ALL" | "ANY";
  rules: SegmentRuleInput[];
}) {
  validateSegmentRules({ matchMode: input.matchMode, rules: input.rules });

  const where = buildSegmentWhere({
    companyId: input.companyId,
    matchMode: input.matchMode,
    rules: input.rules,
  });

  const [count, sampleContacts] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.findMany({
      where,
      select: {
        id: true,
        name: true,
        countryCode: true,
        phoneNumber: true,
        email: true,
        city: true,
        optedOutAt: true,
        inboxTags: {
          select: { tag: { select: { name: true } } },
          take: 5,
        },
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    count,
    warnings: segmentWarnings(input.rules, count),
    sampleContacts: sampleContacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      countryCode: contact.countryCode,
      phoneNumber: contact.phoneNumber,
      email: contact.email,
      city: contact.city,
      optedOut: Boolean(contact.optedOutAt),
      tags: contact.inboxTags.map((entry) => entry.tag.name),
    })),
  };
}

export async function getContactSegmentDetail(input: {
  companyId: string;
  segmentId: string;
}) {
  const segment = await prisma.contactSegment.findFirst({
    where: { id: input.segmentId, companyId: input.companyId },
    include: {
      rules: true,
      createdByUser: { select: { id: true, name: true, email: true } },
    },
  });

  if (!segment) throw new ContactSegmentBuilderError("Segment not found.");

  return segment;
}

/**
 * Paginated, dynamically-evaluated contacts for a saved segment.
 * Membership is never stored; rules are evaluated on every request.
 */
export async function getSegmentContactsPage(input: {
  companyId: string;
  segmentId: string;
  page?: number;
  pageSize?: number;
}) {
  const segment = await prisma.contactSegment.findFirst({
    where: { id: input.segmentId, companyId: input.companyId },
    include: { rules: true },
  });

  if (!segment) throw new ContactSegmentBuilderError("Segment not found.");

  const where = buildSegmentWhere({
    companyId: input.companyId,
    matchMode: segment.matchMode,
    rules: normalizeRules(segment.rules),
  });

  const take = Math.min(Math.max(input.pageSize ?? 25, 1), 100);
  const skip = (Math.max(input.page ?? 1, 1) - 1) * take;

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      select: {
        id: true,
        name: true,
        countryCode: true,
        phoneNumber: true,
        email: true,
        city: true,
        companyName: true,
        source: true,
        optedOutAt: true,
        lastRepliedAt: true,
        createdAt: true,
        inboxTags: {
          select: { tag: { select: { name: true } } },
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.contact.count({ where }),
  ]);

  return {
    segment: {
      id: segment.id,
      name: segment.name,
      status: segment.status,
    },
    contacts: contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      countryCode: contact.countryCode,
      phoneNumber: contact.phoneNumber,
      email: contact.email,
      city: contact.city,
      companyName: contact.companyName,
      source: contact.source,
      optedOut: Boolean(contact.optedOutAt),
      lastMessageAt: contact.lastRepliedAt,
      createdAt: contact.createdAt,
      tags: contact.inboxTags.map((entry) => entry.tag.name),
    })),
    pagination: {
      page: Math.max(input.page ?? 1, 1),
      pageSize: take,
      total,
      totalPages: Math.max(Math.ceil(total / take), 1),
    },
  };
}

export async function getSegmentCount(input: {
  companyId: string;
  segmentId: string;
}) {
  const segment = await prisma.contactSegment.findFirst({
    where: { id: input.segmentId, companyId: input.companyId },
    include: { rules: true },
  });

  if (!segment) throw new ContactSegmentBuilderError("Segment not found.");

  const where = buildSegmentWhere({
    companyId: input.companyId,
    matchMode: segment.matchMode,
    rules: normalizeRules(segment.rules),
  });

  return prisma.contact.count({ where });
}

/**
 * Builds a Prisma Contact where clause for a saved segment - used by the
 * contacts page segment filter (and later by the broadcast builder).
 */
export async function buildWhereForSavedSegment(input: {
  companyId: string;
  segmentId: string;
}) {
  const segment = await prisma.contactSegment.findFirst({
    where: { id: input.segmentId, companyId: input.companyId },
    include: { rules: true },
  });

  if (!segment) throw new ContactSegmentBuilderError("Segment not found.");

  return buildSegmentWhere({
    companyId: input.companyId,
    matchMode: segment.matchMode,
    rules: normalizeRules(segment.rules),
  });
}

export async function deleteContactSegment(input: {
  companyId: string;
  segmentId: string;
  actorUserId?: string | null;
}) {
  const segment = await prisma.contactSegment.findFirst({
    where: { id: input.segmentId, companyId: input.companyId },
    select: { id: true, name: true },
  });

  if (!segment) throw new ContactSegmentBuilderError("Segment not found.");

  await prisma.contactSegment.delete({ where: { id: segment.id } });

  await createAuditLog({
    companyId: input.companyId,
    actorUserId: input.actorUserId,
    action: "contact.segment_deleted",
    entityType: "ContactSegment",
    entityId: segment.id,
    metadata: safeJson({ name: segment.name }),
  }).catch(() => undefined);

  return { deleted: true };
}
