import type {
  AutomationEdge,
  AutomationGraph,
  AutomationNode,
} from "@/lib/automation-builder/types";

export type AutomationOutputHandle = {
  id: string;
  label: string;
  required?: boolean;
  type?: "default" | "success" | "error" | "branch" | "timeout";
};

export type AutomationInputHandle = {
  id: string;
  label: string;
};

export type AutomationConnectionCheck =
  | {
      allowed: true;
      ok: true;
      sourceHandle: string;
      targetHandle?: string;
      label?: string;
    }
  | {
      allowed: false;
      ok: false;
      reason: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function defaultHandle(
  id = "next",
  label = "Next",
  required = false,
): AutomationOutputHandle {
  return {
    id,
    label,
    required,
    type: "default",
  };
}

export function getNodeInputHandles(
  node: AutomationNode,
): AutomationInputHandle[] {
  if (node.type === "START" || node.type === "TEMPLATE_TRIGGER") return [];

  return [{ id: "input", label: "Input" }];
}

export function getNodeOutputHandles(
  node: AutomationNode,
): AutomationOutputHandle[] {
  const data: Record<string, unknown> = isRecord(node.data) ? node.data : {};

  if (node.type === "END") return [];

  if (node.type === "START" || node.type === "TEMPLATE_TRIGGER") {
    return [defaultHandle("next", "Next", true)];
  }

  if (node.type === "CONDITION") {
    return [
      { id: "true", label: "True", required: true, type: "success" },
      { id: "false", label: "False", required: true, type: "error" },
    ];
  }

  if (node.type === "API_CALL") {
    return [
      { id: "success", label: "Success", required: true, type: "success" },
      { id: "error", label: "Error", required: false, type: "error" },
    ];
  }

  if (node.type === "WEBHOOK" || node.type === "GOOGLE_SHEET_APPEND_ROW") {
    return [
      { id: "success", label: "Success", required: true, type: "success" },
      { id: "error", label: "Error", required: false, type: "error" },
    ];
  }

  if (node.type === "GOOGLE_SHEET_UPDATE_ROW") {
    return [
      { id: "success", label: "Success", required: true, type: "success" },
      { id: "not_found", label: "Not found", required: false, type: "branch" },
      { id: "error", label: "Error", required: false, type: "error" },
    ];
  }

  if (node.type === "TALLY_LOOKUP") {
    return [
      { id: "found", label: "Found", required: true, type: "success" },
      { id: "not_found", label: "Not found", required: false, type: "branch" },
      { id: "error", label: "Error", required: false, type: "error" },
    ];
  }

  if (node.type === "PAYMENT_LINK") {
    return [
      { id: "created", label: "Created", required: true, type: "success" },
      { id: "error", label: "Error", required: false, type: "error" },
    ];
  }

  if (node.type === "CATALOG_SEND") {
    return [
      { id: "sent", label: "Sent", required: true, type: "success" },
      { id: "failed", label: "Failed", required: false, type: "error" },
    ];
  }

  if (node.type === "AI_REPLY") {
    return [
      { id: "answered", label: "Answered", required: true, type: "success" },
      {
        id: "low_confidence",
        label: "Low confidence",
        required: false,
        type: "branch",
      },
      { id: "error", label: "Error", required: false, type: "error" },
    ];
  }

  if (node.type === "FALLBACK") {
    return [
      { id: "next", label: "Next", required: false, type: "default" },
      { id: "handoff", label: "Handoff", required: false, type: "branch" },
      { id: "end", label: "End", required: false, type: "branch" },
    ];
  }

  if (node.type === "RETRY") {
    return [
      { id: "retry", label: "Retry", required: true, type: "default" },
      {
        id: "max_retries_reached",
        label: "Max retries",
        required: false,
        type: "error",
      },
    ];
  }

  if (node.type === "ERROR_HANDLER") {
    return [{ id: "handled", label: "Handled", required: false, type: "success" }];
  }

  if (node.type === "WAIT_FOR_REPLY") {
    return [
      {
        id: "received",
        label: "Reply received",
        required: true,
        type: "success",
      },
      { id: "timeout", label: "Timeout", required: false, type: "timeout" },
    ];
  }

  if (node.type === "SEND_TEMPLATE") {
    return [
      { id: "sent", label: "Sent", required: false, type: "success" },
      { id: "failed", label: "Failed", required: false, type: "error" },
    ];
  }

  if (node.type === "BUTTON_REPLY_ROUTER") {
    const routes: unknown[] = Array.isArray(data.routes) ? data.routes : [];
    const handles: AutomationOutputHandle[] = [];

    routes.forEach((route) => {
      if (!isRecord(route)) return;

      const buttonId = stringValue(route.buttonId).trim();
      const buttonLabel = stringValue(route.buttonLabel).trim();

      if (!buttonId) return;

      handles.push({
        id: `route:${buttonId}`,
        label: buttonLabel || buttonId,
        required: true,
        type: "branch",
      });
    });

    if (data.fallbackEnabled !== false) {
      handles.push({
        id: "fallback",
        label: "Fallback",
        required: false,
        type: "error",
      });
    }

    return handles;
  }

  if (node.type === "QUICK_REPLY") {
    const buttons: unknown[] = Array.isArray(data.buttons) ? data.buttons : [];
    const handles: AutomationOutputHandle[] = [];

    buttons.forEach((button) => {
      if (!isRecord(button)) return;

      const buttonId = stringValue(button.id).trim();
      const label = stringValue(button.label).trim();

      if (!buttonId) return;

      handles.push({
        id: `button:${buttonId}`,
        label: label || buttonId,
        required: true,
        type: "branch",
      });
    });

    return handles.length > 0 ? handles : [defaultHandle()];
  }

  if (node.type === "LIST_MESSAGE") {
    const sections: unknown[] = Array.isArray(data.sections) ? data.sections : [];
    const handles: AutomationOutputHandle[] = [];

    sections.forEach((section) => {
      if (!isRecord(section) || !Array.isArray(section.items)) return;

      section.items.forEach((item) => {
        if (!isRecord(item)) return;

        const itemId = stringValue(item.id).trim();
        const title = stringValue(item.title).trim();

        if (!itemId) return;

        handles.push({
          id: `item:${itemId}`,
          label: title || itemId,
          required: true,
          type: "branch",
        });
      });
    });

    return handles.length > 0 ? handles : [defaultHandle()];
  }

  if (node.type === "HUMAN_HANDOFF") {
    return [defaultHandle("assigned", "Assigned")];
  }

  if (node.type === "DELAY") {
    return [defaultHandle("next", "Next", true)];
  }

  return [defaultHandle()];
}

export function resolveSourceHandleId(
  node: AutomationNode,
  sourceHandle?: string | null,
) {
  const outputHandles = getNodeOutputHandles(node);
  if (sourceHandle) return sourceHandle;
  if (outputHandles.length === 1) return outputHandles[0]?.id;
  return undefined;
}

export function resolveTargetHandleId(
  node: AutomationNode,
  targetHandle?: string | null,
) {
  const inputHandles = getNodeInputHandles(node);
  if (targetHandle) return targetHandle;
  if (inputHandles.length === 1) return inputHandles[0]?.id;
  return undefined;
}

export function getEdgeLabelForSourceHandle(
  sourceNode: AutomationNode,
  sourceHandle?: string | null,
) {
  const resolvedHandle = resolveSourceHandleId(sourceNode, sourceHandle);
  const outputHandle = getNodeOutputHandles(sourceNode).find(
    (handle) => handle.id === resolvedHandle,
  );

  return outputHandle?.label;
}

export function canCreateConnection({
  graph,
  source,
  sourceHandle,
  target,
  targetHandle,
}: {
  graph: AutomationGraph;
  source?: string | null;
  sourceHandle?: string | null;
  target?: string | null;
  targetHandle?: string | null;
}): AutomationConnectionCheck {
  if (!source || !target) {
    return {
      allowed: false,
      ok: false,
      reason: "Choose a source and target node.",
    };
  }

  if (source === target) {
    return {
      allowed: false,
      ok: false,
      reason: "Connect two different nodes.",
    };
  }

  const sourceNode = graph.nodes.find((node) => node.id === source);
  const targetNode = graph.nodes.find((node) => node.id === target);

  if (!sourceNode || !targetNode) {
    return {
      allowed: false,
      ok: false,
      reason: "Connection references a missing node.",
    };
  }

  const outputHandles = getNodeOutputHandles(sourceNode);
  const inputHandles = getNodeInputHandles(targetNode);

  if (outputHandles.length === 0) {
    return {
      allowed: false,
      ok: false,
      reason: "This source node has no output path.",
    };
  }

  if (inputHandles.length === 0) {
    return {
      allowed: false,
      ok: false,
      reason: "This target node cannot receive input.",
    };
  }

  const resolvedSourceHandle = resolveSourceHandleId(sourceNode, sourceHandle);
  const resolvedTargetHandle = resolveTargetHandleId(targetNode, targetHandle);

  if (!resolvedSourceHandle) {
    return { allowed: false, ok: false, reason: "Choose a source path." };
  }

  if (!resolvedTargetHandle) {
    return { allowed: false, ok: false, reason: "Choose a target input." };
  }

  if (!outputHandles.some((handle) => handle.id === resolvedSourceHandle)) {
    return {
      allowed: false,
      ok: false,
      reason: "This source path no longer exists.",
    };
  }

  if (!inputHandles.some((handle) => handle.id === resolvedTargetHandle)) {
    return {
      allowed: false,
      ok: false,
      reason: "This target input no longer exists.",
    };
  }

  const duplicate = graph.edges.some((edge: AutomationEdge) => {
    if (edge.source !== source) return false;

    const edgeSourceNode = graph.nodes.find((node) => node.id === edge.source);
    if (!edgeSourceNode) return false;

    return (
      resolveSourceHandleId(edgeSourceNode, edge.sourceHandle) ===
      resolvedSourceHandle
    );
  });

  if (duplicate) {
    return {
      allowed: false,
      ok: false,
      reason: "This path is already connected.",
    };
  }

  return {
    allowed: true,
    label: getEdgeLabelForSourceHandle(sourceNode, resolvedSourceHandle),
    ok: true,
    sourceHandle: resolvedSourceHandle,
    targetHandle: resolvedTargetHandle,
  };
}
