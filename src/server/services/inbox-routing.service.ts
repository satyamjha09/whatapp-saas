import {
  InboxAssignmentSource,
  InboxAssignmentMode,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assignConversationToBestAgent } from "@/server/services/inbox-assignment.service";
import type {
  CreateInboxRoutingRuleInput,
} from "@/server/validators/inbox-routing-rule.validator";

type RoutingCondition = CreateInboxRoutingRuleInput["conditions"][number];

type RouteConversationInput = {
  actorUserId?: string | null;
  companyId: string;
  contactId: string;
  handoffReason?: string | null;
  inboundText?: string | null;
  metadata?: Prisma.InputJsonValue;
  requestedQueueId?: string | null;
  source?: InboxAssignmentSource;
};

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function jsonObject(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function valueList(value: unknown) {
  return Array.isArray(value) ? value.map(normalize) : [normalize(value)];
}

function compareCondition(actual: unknown, condition: RoutingCondition) {
  const actualText = normalize(actual);
  const expectedValues = valueList(condition.value);
  const expectedText = expectedValues[0] ?? "";

  switch (condition.operator) {
    case "CONTAINS":
      return actualText.includes(expectedText);
    case "EQUALS":
      return actualText === expectedText;
    case "EXISTS":
      return actual !== null && actual !== undefined && actualText.length > 0;
    case "GT":
      return Number(actual) > Number(condition.value);
    case "GTE":
      return Number(actual) >= Number(condition.value);
    case "IN":
      return expectedValues.includes(actualText);
    case "LT":
      return Number(actual) < Number(condition.value);
    case "LTE":
      return Number(actual) <= Number(condition.value);
    case "NOT_EQUALS":
      return actualText !== expectedText;
    default:
      return false;
  }
}

function parseSkillIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function conditionMatches({
  condition,
  contact,
  handoffReason,
  inboundText,
}: {
  condition: RoutingCondition;
  contact: Awaited<ReturnType<typeof loadRoutingContact>>;
  handoffReason?: string | null;
  inboundText?: string | null;
}) {
  switch (condition.field) {
    case "MESSAGE_CONTAINS":
      return compareCondition(inboundText, condition);
    case "MESSAGE_LANGUAGE":
      return compareCondition(jsonObject(contact.customAttributes)["language"], condition);
    case "CONTACT_TAG": {
      const expectedValues = valueList(condition.value);
      return contact.inboxTags.some((contactTag) =>
        expectedValues.includes(normalize(contactTag.tag.name)) ||
        expectedValues.includes(contactTag.tagId),
      );
    }
    case "CONTACT_CITY":
      return compareCondition(contact.city, condition);
    case "CONTACT_SOURCE":
      return compareCondition(contact.source, condition);
    case "LEAD_SCORE":
      return compareCondition(contact.leadScore, condition);
    case "LIFECYCLE_STAGE":
      return compareCondition(contact.lifecycleStage, condition);
    case "CAMPAIGN_SOURCE":
      return compareCondition(
        jsonObject(contact.customAttributes)["campaignSource"],
        condition,
      );
    case "WHATSAPP_NUMBER":
      return compareCondition(`${contact.countryCode}${contact.phoneNumber}`, condition);
    case "BUSINESS_HOURS":
      return true;
    case "CHATBOT_HANDOFF_REASON":
      return compareCondition(handoffReason, condition);
    default:
      return false;
  }
}

async function loadRoutingContact({
  companyId,
  contactId,
}: {
  companyId: string;
  contactId: string;
}) {
  const contact = await prisma.contact.findFirst({
    where: {
      companyId,
      id: contactId,
    },
    include: {
      inboxTags: {
        include: {
          tag: true,
        },
      },
    },
  });

  if (!contact) {
    throw new Error("Contact not found");
  }

  return contact;
}

function ruleMatches({
  contact,
  handoffReason,
  inboundText,
  rule,
}: {
  contact: Awaited<ReturnType<typeof loadRoutingContact>>;
  handoffReason?: string | null;
  inboundText?: string | null;
  rule: {
    conditions: Prisma.JsonValue;
  };
}) {
  if (!Array.isArray(rule.conditions)) return false;

  return rule.conditions.every((condition) => {
    const parsedCondition = condition as RoutingCondition;
    return conditionMatches({
      condition: parsedCondition,
      contact,
      handoffReason,
      inboundText,
    });
  });
}

export async function routeConversation(input: RouteConversationInput) {
  const contact = await loadRoutingContact({
    companyId: input.companyId,
    contactId: input.contactId,
  });

  if (input.requestedQueueId) {
    return assignConversationToBestAgent({
      companyId: input.companyId,
      contactId: contact.id,
      metadata: input.metadata,
      queueId: input.requestedQueueId,
      reason: input.handoffReason ?? "Requested queue",
      source: input.source ?? InboxAssignmentSource.CHATBOT,
    });
  }

  const rules = await prisma.inboxRoutingRule.findMany({
    where: {
      companyId: input.companyId,
      status: "ACTIVE",
    },
    include: {
      targetQueue: true,
    },
    orderBy: [
      {
        priority: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
  });

  for (const rule of rules) {
    if (
      !ruleMatches({
        contact,
        handoffReason: input.handoffReason,
        inboundText: input.inboundText,
        rule,
      })
    ) {
      continue;
    }

    try {
      return await assignConversationToBestAgent({
        actorUserId: input.actorUserId,
        assignmentMode: rule.assignmentMode ?? rule.targetQueue.assignmentMode,
        companyId: input.companyId,
        contactId: contact.id,
        metadata: input.metadata,
        queueId: rule.targetQueueId,
        reason: input.handoffReason ?? `Matched routing rule: ${rule.name}`,
        requiredSkillIds: parseSkillIds(rule.requiredSkillIds),
        ruleId: rule.id,
        source: input.source ?? InboxAssignmentSource.ROUTING_RULE,
      });
    } catch (error) {
      if (!rule.fallbackQueueId) throw error;

      return assignConversationToBestAgent({
        actorUserId: input.actorUserId,
        assignmentMode: InboxAssignmentMode.LEAST_OPEN,
        companyId: input.companyId,
        contactId: contact.id,
        metadata: input.metadata,
        queueId: rule.fallbackQueueId,
        reason: `Fallback for routing rule: ${rule.name}`,
        ruleId: rule.id,
        source: input.source ?? InboxAssignmentSource.ROUTING_RULE,
      });
    }
  }

  return null;
}
