import type {
  AutomationFlow,
  AutomationFlowVersion,
} from "@/generated/prisma/client";
import type { AutomationTriggerType } from "@/generated/prisma/enums";
import type { AutomationGraph, AutomationNode } from "@/lib/automation-builder/types";
import { prisma } from "@/lib/prisma";
import {
  asRecord,
  extractInboundTrigger,
  graphFromJson,
  normalizedText,
  stringValue,
  type AutomationRuntimeContact,
  type AutomationRuntimeMessage,
  type AutomationTriggerSnapshot,
} from "@/server/services/automation-context.service";

export type PublishedAutomationFlowMatch = {
  flow: AutomationFlow;
  rootNodeId: string | null;
  triggerPayload: Record<string, unknown>;
  triggerType: AutomationTriggerType;
  version: AutomationFlowVersion;
};

type Candidate = {
  flow: AutomationFlow;
  graph: AutomationGraph;
  version: AutomationFlowVersion;
};

function getRootNodes(graph: AutomationGraph) {
  return graph.nodes.filter(
    (node) => node.type === "START" || node.type === "TEMPLATE_TRIGGER",
  );
}

function getStartKeywords(flow: AutomationFlow, roots: AutomationNode[]) {
  const keywords = new Set<string>();

  flow.keywords.forEach((keyword) => {
    const normalized = normalizedText(keyword);
    if (normalized) keywords.add(normalized);
  });

  roots.forEach((root) => {
    const data = asRecord(root.data);
    const rootKeywords = Array.isArray(data.keywords) ? data.keywords : [];

    rootKeywords.forEach((keyword) => {
      const normalized = normalizedText(stringValue(keyword));
      if (normalized) keywords.add(normalized);
    });
  });

  return [...keywords];
}

function rootAllowsContainsMatch(roots: AutomationNode[]) {
  return roots.some((root) => {
    const data = asRecord(root.data);
    return data.allowContainsMatch === true || data.matchMode === "CONTAINS";
  });
}

function findKeywordMatch({
  candidate,
  trigger,
}: {
  candidate: Candidate;
  trigger: AutomationTriggerSnapshot;
}) {
  const roots = getRootNodes(candidate.graph);
  const keywords = getStartKeywords(candidate.flow, roots);
  const text = normalizedText(trigger.text);

  if (!text || keywords.length === 0) return null;

  const exact = keywords.find((keyword) => keyword === text);
  if (exact) {
    return roots.find((root) => root.type === "START")?.id ?? null;
  }

  if (rootAllowsContainsMatch(roots)) {
    const contains = keywords.find((keyword) => text.includes(keyword));
    if (contains) {
      return roots.find((root) => root.type === "START")?.id ?? null;
    }
  }

  return null;
}

function findTemplateTriggerRoot({
  campaignId,
  candidate,
  templateId,
  trigger,
}: {
  campaignId?: string | null;
  candidate: Candidate;
  templateId?: string | null;
  trigger: AutomationTriggerSnapshot;
}) {
  return getRootNodes(candidate.graph).find((root) => {
    if (root.type !== "TEMPLATE_TRIGGER") return false;

    const data = asRecord(root.data);
    const triggerMode = stringValue(data.triggerMode, "ANY_TEMPLATE_REPLY");

    if (triggerMode === "ANY_TEMPLATE_REPLY") return true;

    if (triggerMode === "SPECIFIC_TEMPLATE_REPLY") {
      return Boolean(templateId && data.templateId === templateId);
    }

    if (triggerMode === "SPECIFIC_CAMPAIGN_REPLY") {
      return Boolean(campaignId && data.campaignId === campaignId);
    }

    if (triggerMode === "BUTTON_REPLY") {
      const buttonIds = Array.isArray(data.buttonIds) ? data.buttonIds : [];
      const buttonId = trigger.buttonId ?? trigger.buttonText;

      return buttonIds.some(
        (candidateButtonId) =>
          normalizedText(stringValue(candidateButtonId)) ===
          normalizedText(buttonId),
      );
    }

    if (triggerMode === "TEXT_REPLY") {
      const keywords = Array.isArray(data.keywords) ? data.keywords : [];

      return keywords.some(
        (keyword) => normalizedText(stringValue(keyword)) === normalizedText(trigger.text),
      );
    }

    return false;
  });
}

function findDefaultRoot(candidate: Candidate) {
  if (candidate.flow.isDefault || candidate.flow.triggerType === "DEFAULT") {
    return getRootNodes(candidate.graph).find((root) => root.type === "START")?.id ?? null;
  }

  return (
    getRootNodes(candidate.graph).find((root) => {
      if (root.type !== "START") return false;
      const data = asRecord(root.data);
      return data.triggerType === "DEFAULT";
    })?.id ?? null
  );
}

async function getReplySourceMessage({
  companyId,
  inboundMessage,
}: {
  companyId: string;
  inboundMessage: AutomationRuntimeMessage;
}) {
  const metadata = asRecord(inboundMessage.metadata);
  const contextMetaMessageId = stringValue(metadata.contextMetaMessageId);

  if (!contextMetaMessageId) return null;

  return prisma.message.findFirst({
    where: {
      companyId,
      direction: "OUTBOUND",
      metaMessageId: contextMetaMessageId,
    },
    select: {
      campaignId: true,
      campaignContactId: true,
      id: true,
      templateId: true,
    },
  });
}

async function loadPublishedCandidates(companyId: string): Promise<Candidate[]> {
  const flows = await prisma.automationFlow.findMany({
    where: {
      companyId,
      publishedVersionId: {
        not: null,
      },
      status: "PUBLISHED",
    },
    orderBy: [
      {
        updatedAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
  });

  const versionIds = flows
    .map((flow) => flow.publishedVersionId)
    .filter((versionId): versionId is string => Boolean(versionId));

  if (versionIds.length === 0) return [];

  const versions = await prisma.automationFlowVersion.findMany({
    where: {
      companyId,
      id: {
        in: versionIds,
      },
    },
  });

  const versionById = new Map(versions.map((version) => [version.id, version]));

  return flows.flatMap((flow) => {
    const version = flow.publishedVersionId
      ? versionById.get(flow.publishedVersionId)
      : null;
    const graph = version ? graphFromJson(version.graph) : null;

    if (!version || !graph) return [];

    return [
      {
        flow,
        graph,
        version,
      },
    ];
  });
}

function buildMatch({
  candidate,
  rootNodeId,
  trigger,
  triggerPayload,
  triggerType,
}: {
  candidate: Candidate;
  rootNodeId: string | null;
  trigger: AutomationTriggerSnapshot;
  triggerPayload: Record<string, unknown>;
  triggerType: AutomationTriggerType;
}): PublishedAutomationFlowMatch {
  return {
    flow: candidate.flow,
    rootNodeId,
    triggerPayload: {
      ...triggerPayload,
      trigger,
    },
    triggerType,
    version: candidate.version,
  };
}

export async function findMatchingPublishedAutomationFlow(
  companyId: string,
  contact: AutomationRuntimeContact,
  inboundMessage: AutomationRuntimeMessage,
): Promise<PublishedAutomationFlowMatch | null> {
  const trigger = extractInboundTrigger(inboundMessage);
  const sourceMessage = await getReplySourceMessage({
    companyId,
    inboundMessage,
  });
  const campaignId = inboundMessage.campaignId ?? sourceMessage?.campaignId;
  const templateId = inboundMessage.templateId ?? sourceMessage?.templateId;
  const candidates = await loadPublishedCandidates(companyId);

  if (candidates.length === 0) return null;

  if (trigger.buttonId || trigger.buttonText) {
    const match = candidates.find((candidate) => {
      if (candidate.flow.triggerType === "BUTTON_REPLY") return true;

      const root = findTemplateTriggerRoot({
        campaignId,
        candidate,
        templateId,
        trigger,
      });

      return Boolean(root);
    });

    if (match) {
      const root = findTemplateTriggerRoot({
        campaignId,
        candidate: match,
        templateId,
        trigger,
      });

      return buildMatch({
        candidate: match,
        rootNodeId: root?.id ?? getRootNodes(match.graph)[0]?.id ?? null,
        trigger,
        triggerPayload: {
          contactId: contact.id,
          sourceMessage,
        },
        triggerType: "BUTTON_REPLY",
      });
    }
  }

  if (trigger.listItemId || trigger.listItemText) {
    const match = candidates.find(
      (candidate) => candidate.flow.triggerType === "LIST_REPLY",
    );

    if (match) {
      return buildMatch({
        candidate: match,
        rootNodeId: getRootNodes(match.graph)[0]?.id ?? null,
        trigger,
        triggerPayload: {
          contactId: contact.id,
          sourceMessage,
        },
        triggerType: "LIST_REPLY",
      });
    }
  }

  if (campaignId || templateId) {
    const match = candidates.find((candidate) => {
      if (campaignId && candidate.flow.triggerType === "CAMPAIGN_REPLY") {
        return true;
      }

      if (templateId && candidate.flow.triggerType === "TEMPLATE_REPLY") {
        return true;
      }

      return Boolean(
        findTemplateTriggerRoot({
          campaignId,
          candidate,
          templateId,
          trigger,
        }),
      );
    });

    if (match) {
      const root = findTemplateTriggerRoot({
        campaignId,
        candidate: match,
        templateId,
        trigger,
      });

      return buildMatch({
        candidate: match,
        rootNodeId: root?.id ?? getRootNodes(match.graph)[0]?.id ?? null,
        trigger,
        triggerPayload: {
          contactId: contact.id,
          sourceMessage,
        },
        triggerType: campaignId ? "CAMPAIGN_REPLY" : "TEMPLATE_REPLY",
      });
    }
  }

  const keywordMatch = candidates
    .map((candidate) => ({
      candidate,
      rootNodeId: findKeywordMatch({
        candidate,
        trigger,
      }),
    }))
    .find((match) => match.rootNodeId !== null);

  if (keywordMatch) {
    return buildMatch({
      candidate: keywordMatch.candidate,
      rootNodeId: keywordMatch.rootNodeId,
      trigger,
      triggerPayload: {
        contactId: contact.id,
      },
      triggerType: "KEYWORD",
    });
  }

  const defaultMatches = candidates
    .map((candidate) => ({
      candidate,
      rootNodeId: findDefaultRoot(candidate),
    }))
    .filter((match) => match.rootNodeId !== null);

  if (defaultMatches.length > 1) {
    console.warn("AUTOMATION_MULTIPLE_DEFAULT_FLOWS", {
      companyId,
      flowIds: defaultMatches.map((match) => match.candidate.flow.id),
    });
  }

  const defaultMatch = defaultMatches[0];
  if (!defaultMatch) return null;

  return buildMatch({
    candidate: defaultMatch.candidate,
    rootNodeId: defaultMatch.rootNodeId,
    trigger,
    triggerPayload: {
      contactId: contact.id,
    },
    triggerType: "DEFAULT",
  });
}
