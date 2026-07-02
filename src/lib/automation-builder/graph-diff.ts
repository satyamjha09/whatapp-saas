import {
  normalizeAutomationGraph,
} from "@/lib/automation-builder/graph-validation";
import type { AutomationGraph } from "@/lib/automation-builder/types";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortValue((value as Record<string, unknown>)[key]);
        return result;
      }, {});
  }

  return value;
}

export function stableGraphStringify(graph: AutomationGraph | null | undefined) {
  return JSON.stringify(graph ? sortValue(normalizeAutomationGraph(graph)) : null);
}

export function hasUnpublishedChanges(
  draftGraph: AutomationGraph | null | undefined,
  publishedGraph: AutomationGraph | null | undefined,
) {
  return stableGraphStringify(draftGraph) !== stableGraphStringify(publishedGraph);
}

export function summarizeGraphChanges(
  oldGraph: AutomationGraph | null | undefined,
  newGraph: AutomationGraph | null | undefined,
) {
  const oldNormalized = oldGraph ? normalizeAutomationGraph(oldGraph) : null;
  const newNormalized = newGraph ? normalizeAutomationGraph(newGraph) : null;
  const oldNodeIds = new Set(oldNormalized?.nodes.map((node) => node.id) ?? []);
  const newNodeIds = new Set(newNormalized?.nodes.map((node) => node.id) ?? []);
  const oldEdgeIds = new Set(oldNormalized?.edges.map((edge) => edge.id) ?? []);
  const newEdgeIds = new Set(newNormalized?.edges.map((edge) => edge.id) ?? []);

  return {
    addedEdges: [...newEdgeIds].filter((edgeId) => !oldEdgeIds.has(edgeId)).length,
    addedNodes: [...newNodeIds].filter((nodeId) => !oldNodeIds.has(nodeId)).length,
    edgeCountAfter: newNormalized?.edges.length ?? 0,
    edgeCountBefore: oldNormalized?.edges.length ?? 0,
    nodeCountAfter: newNormalized?.nodes.length ?? 0,
    nodeCountBefore: oldNormalized?.nodes.length ?? 0,
    removedEdges: [...oldEdgeIds].filter((edgeId) => !newEdgeIds.has(edgeId)).length,
    removedNodes: [...oldNodeIds].filter((nodeId) => !newNodeIds.has(nodeId)).length,
  };
}
