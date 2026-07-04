"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  type NodeProps,
  Panel as ReactFlowPanel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from "@xyflow/react";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  History,
  Lock,
  PauseCircle,
  PlusCircle,
  PlayCircle,
  Redo2,
  Rocket,
  Save,
  Search,
  Send,
  TestTube2,
  Trash2,
  Undo2,
  Workflow,
  X,
} from "lucide-react";
import { useAutomationPermissions } from "./permission-guard";
import RequestPublishModal from "../automation-approvals/request-publish-modal";
import type { AutomationPermissionName } from "@/lib/automation-permissions";
import LockedNodeModal from "./locked-node-card";
import UpgradeRequiredBanner from "./upgrade-required-banner";
import AutomationTestPanel from "@/components/automation-builder/automation-test-panel";
import type { AutomationTestRun } from "@/components/automation-builder/automation-test-types";
import AutomationVersionHistoryPanel, {
  type AutomationRollbackResult,
} from "@/components/automation-builder/automation-version-history-panel";
import NodeEditingDrawer from "@/components/automation-builder/node-editing-drawer";
import NodePalette from "@/components/automation-builder/node-palette";
import NodeRenderer, {
  type AutomationFlowNode,
} from "@/components/automation-builder/node-renderer";
import {
  createDefaultAutomationGraph,
  createDefaultNodeData,
  automationNodeTypes,
  getAutomationNodeDescription,
  getAutomationNodeLabel,
  normalizeAutomationGraph,
  normalizeAutomationNodeData,
  type AutomationGraph,
  type AutomationNode,
  type AutomationNodeData,
  type AutomationNodeType,
} from "@/components/automation-builder/types";
import {
  canCreateConnection,
  getEdgeLabelForSourceHandle,
  getNodeInputHandles,
  getNodeOutputHandles,
  resolveSourceHandleId,
} from "@/lib/automation-builder/connection-handles";
import {
  isAutomationNodeTypeEnabled,
} from "@/lib/automation-builder/feature-flags";
import { hasUnpublishedChanges as detectUnpublishedChanges } from "@/lib/automation-builder/graph-diff";
import { validateAutomationGraph } from "@/lib/automation-builder/graph-validation";
import type { AutomationGraphValidationIssue } from "@/lib/automation-builder/types";

type AutomationBuilderFlowStatus = "DRAFT" | "PUBLISHED" | "PAUSED" | "ARCHIVED";

interface ChecklistMetadata {
  sourceTemplateSlug?: string;
  sourceTemplateName?: string;
  setupChecklist?: Array<{
    key: string;
    title: string;
    description: string;
    required: boolean;
    completedBy: string;
    completed: boolean;
  }>;
}

function validationIssueKey(
  issue: AutomationGraphValidationIssue,
  index: number,
  scope: string,
) {
  return [
    scope,
    issue.severity,
    issue.code,
    issue.nodeId ?? issue.edgeId ?? "graph",
    issue.message,
    index,
  ].join("-");
}

export type AutomationBuilderInitialFlow = {
  currentVersionNumber: number | null;
  description: string | null;
  hasUnpublishedChanges: boolean;
  id: string;
  lastPublishedByUserId: string | null;
  name: string;
  publishedAt: string | null;
  publishedGraph: AutomationGraph | null;
  publishedVersionId: string | null;
  status: AutomationBuilderFlowStatus;
  updatedAt: string;
  metadata?: unknown;
};

type AutomationBuilderProps = {
  flowId: string;
  initialFlow?: AutomationBuilderInitialFlow;
  initialGraph?: AutomationGraph;
  layout?: "dashboard" | "fullscreen";
  userRole?: string;
  approvalRequired?: boolean;
  permissions?: Partial<Record<AutomationPermissionName, boolean>>;
};

type NodeAddPickerState = {
  sourceHandle: string;
  sourceNodeId: string;
} | null;

type GraphHistoryState = {
  past: AutomationGraph[];
  future: AutomationGraph[];
};

const MAX_GRAPH_HISTORY = 50;

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function cloneGraph(graph: AutomationGraph): AutomationGraph {
  return JSON.parse(JSON.stringify(graph)) as AutomationGraph;
}

function graphFingerprint(graph: AutomationGraph) {
  return JSON.stringify(graph);
}

function isTextEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.isContentEditable
  );
}

function toFlowNode(node: AutomationNode): AutomationFlowNode {
  return {
    data: {
      ...node.data,
      label: node.data.label || getAutomationNodeLabel(node.type),
      nodeType: node.type,
    },
    id: node.id,
    position: node.position,
    type: "automationNode",
  };
}

function toFlowEdge(edge: AutomationGraph["edges"][number]): Edge {
  return {
    id: edge.id,
    label: edge.label,
    markerEnd: {
      color: "#128C7E",
      type: MarkerType.ArrowClosed,
    },
    source: edge.source,
    sourceHandle: edge.sourceHandle,
    style: {
      stroke: "#128C7E",
      strokeWidth: 2,
    },
    target: edge.target,
    targetHandle: edge.targetHandle,
  };
}

function toGraphEdge(edge: Edge): AutomationGraph["edges"][number] {
  return {
    id: edge.id,
    label: typeof edge.label === "string" ? edge.label : undefined,
    sourceHandle: edge.sourceHandle ?? undefined,
    source: edge.source,
    targetHandle: edge.targetHandle ?? undefined,
    target: edge.target,
  };
}

function toGraphSnapshot(
  nodes: AutomationFlowNode[],
  edges: Edge[],
): AutomationGraph {
  return {
    edges: edges.map(toGraphEdge),
    nodes: nodes.map(toGraphNode),
    version: 1,
  };
}

function calculateNewPosition(count: number) {
  return {
    x: 140 + (count % 4) * 300,
    y: 120 + Math.floor(count / 4) * 170,
  };
}

function createFlowNode(
  type: AutomationNodeType,
  position: { x: number; y: number },
): AutomationFlowNode {
  const data = createDefaultNodeData(type);

  return {
    data: {
      ...data,
      label: data.label || getAutomationNodeLabel(type),
      nodeType: type,
    },
    id: createId(`node_${type.toLowerCase()}`),
    position,
    selected: true,
    type: "automationNode",
  };
}

function nodeCanReceiveInput(type: AutomationNodeType) {
  const previewNode: AutomationNode = {
    data: createDefaultNodeData(type),
    id: "preview",
    position: { x: 0, y: 0 },
    type,
  };

  return getNodeInputHandles(previewNode).length > 0;
}

function avoidNodeOverlap(
  position: { x: number; y: number },
  existingNodes: AutomationFlowNode[],
) {
  const next = {
    x: Math.round(position.x),
    y: Math.round(position.y),
  };
  const originY = next.y;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const hasOverlap = existingNodes.some(
      (node) =>
        Math.abs(node.position.x - next.x) < 280 &&
        Math.abs(node.position.y - next.y) < 145,
    );

    if (!hasOverlap) return next;

    next.y += 170;

    if ((attempt + 1) % 4 === 0) {
      next.x += 320;
      next.y = originY;
    }
  }

  return next;
}

function calculateConnectedPosition({
  existingNodes,
  sourceHandle,
  sourceNode,
}: {
  existingNodes: AutomationFlowNode[];
  sourceHandle: string;
  sourceNode: AutomationFlowNode;
}) {
  const sourceGraphNode = toGraphNode(sourceNode);
  const outputHandles = getNodeOutputHandles(sourceGraphNode);
  const handleIndex = Math.max(
    0,
    outputHandles.findIndex((handle) => handle.id === sourceHandle),
  );
  const branchOffset =
    outputHandles.length > 1
      ? (handleIndex - (outputHandles.length - 1) / 2) * 170
      : 0;

  return avoidNodeOverlap(
    {
      x: sourceNode.position.x + 360,
      y: sourceNode.position.y + branchOffset,
    },
    existingNodes,
  );
}

async function readAutomationJson<T>(response: Response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data.message === "string" ? data.message : "Automation request failed",
    );
  }

  return data as T;
}

function toGraphNode(node: AutomationFlowNode): AutomationNode {
  const nodeType = node.data.nodeType;
  const data: Record<string, unknown> = { ...node.data };
  delete data.nodeType;
  delete data.testIsCurrent;
  delete data.testStatus;
  delete data.validationIssueCount;
  delete data.validationSeverity;

  return {
    data: normalizeAutomationNodeData(nodeType, data),
    id: node.id,
    position: {
      x: Math.round(node.position.x),
      y: Math.round(node.position.y),
    },
    type: nodeType,
  };
}

export default function AutomationBuilder({
  flowId,
  initialFlow,
  initialGraph,
  layout = "dashboard",
  userRole = "MEMBER",
  approvalRequired = false,
  permissions: permissionOverrides,
}: AutomationBuilderProps) {
  const { canEdit, canPublish, canRequestPublish } = useAutomationPermissions({
    approvalRequired,
    permissionOverrides,
    userRole,
  });

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [planLimits, setPlanLimits] = useState<{
    planName: string;
    allowedNodes: string[];
    lockedNodes: Array<{ nodeType: string; requiredPlan: string }>;
  } | null>(null);
  const [usageSummary, setUsageSummary] = useState<{
    limits: {
      executions: number | null;
      flows: number | null;
    };
    usage: {
      executionsUsed: number;
      flowsUsed: number;
    };
  } | null>(null);
  const [lockedModalNodeType, setLockedModalNodeType] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLimits() {
      try {
        const res = await fetch("/api/automation/plan-limits");
        if (res.ok) {
          const data = await res.json();
          setPlanLimits(data);
        }
      } catch (err) {
        console.error("Failed to load plan limits:", err);
      }
    }
    void fetchLimits();
  }, []);

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch("/api/automation/usage");
        if (res.ok) {
          const data = await res.json();
          setUsageSummary(data);
        }
      } catch (err) {
        console.error("Failed to load automation usage:", err);
      }
    }

    void fetchUsage();
  }, []);

  const graph = useMemo(
    () => normalizeAutomationGraph(initialGraph ?? createDefaultAutomationGraph()),
    [initialGraph],
  );
  const initialNodes = useMemo(
    () => graph.nodes.map(toFlowNode),
    [graph.nodes],
  );
  const initialEdges = useMemo(
    () => graph.edges.map(toFlowEdge),
    [graph.edges],
  );
  const dragStartGraphRef = useRef<AutomationGraph | null>(null);
  const [nodes, setNodes, onNodesChange] =
    useNodesState<AutomationFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const currentDraftLockedNodes = useMemo(() => {
    if (!planLimits?.allowedNodes) return [];
    const nodeTypes = Array.from(new Set(nodes.map((n) => n.data.nodeType)));
    return nodeTypes.filter((t) => !planLimits.allowedNodes.includes(t));
  }, [nodes, planLimits]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [historyState, setHistoryState] = useState<GraphHistoryState>({
    future: [],
    past: [],
  });
  const [lastSavedGraphKey, setLastSavedGraphKey] = useState(() =>
    graphFingerprint(toGraphSnapshot(initialNodes, initialEdges)),
  );
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(
    initialFlow?.updatedAt ?? null,
  );
  const [nodeAddPicker, setNodeAddPicker] =
    useState<NodeAddPickerState>(null);
  const [nodeAddSearch, setNodeAddSearch] = useState("");
  const [isTestPanelOpen, setIsTestPanelOpen] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [testRun, setTestRun] = useState<AutomationTestRun | null>(null);
  const [flowState, setFlowState] = useState<AutomationBuilderInitialFlow>(
    initialFlow ?? {
      currentVersionNumber: null,
      description: null,
      hasUnpublishedChanges: true,
      id: flowId,
      lastPublishedByUserId: null,
      name: "WhatsApp Automation Flow",
      publishedAt: null,
      publishedGraph: null,
      publishedVersionId: null,
      status: "DRAFT",
      updatedAt: "",
    },
  );
  const [publishedGraph, setPublishedGraph] = useState<AutomationGraph | null>(
    initialFlow?.publishedGraph ?? null,
  );
  const [publishNotes, setPublishNotes] = useState("");
  const [publishWarningsAccepted, setPublishWarningsAccepted] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [isChecklistCollapsed, setIsChecklistCollapsed] = useState(false);

  const checklist = useMemo(() => {
    const meta = flowState.metadata as ChecklistMetadata | null | undefined;
    if (!meta || !meta.setupChecklist) return [];

    const list = meta.setupChecklist as Array<{
      key: string;
      title: string;
      description: string;
      required: boolean;
      completedBy: string;
      completed: boolean;
    }>;

    const hasResolvedValue = (value: unknown) => {
      return (
        typeof value === "string" &&
        value.trim().length > 0 &&
        !value.trim().startsWith("{{")
      );
    };

    return list.map((item) => {
      let completed = Boolean(item.completed);

      if (item.completedBy === "TEMPLATE_MAPPING") {
        const hasTemplateMapped = nodes.some(
          (n) =>
            n.data?.nodeType === "SEND_TEMPLATE" &&
            hasResolvedValue(n.data?.templateId)
        );
        if (hasTemplateMapped) {
          completed = true;
        }
      } else if (item.completedBy === "INTEGRATION_MAPPING") {
        const keySuffix = item.key.replace("CONNECT_", "");
        if (keySuffix === "CASHFREE") {
          completed = Boolean(item.completed);
        } else if (keySuffix === "GOOGLE") {
          const hasGoogle = nodes.some(
            (n) =>
              n.data?.nodeType === "GOOGLE_SHEET_APPEND_ROW" &&
              hasResolvedValue(n.data?.connectedGoogleAccountId)
          );
          if (hasGoogle) completed = true;
        } else if (keySuffix === "TALLY") {
          completed = Boolean(item.completed);
        }
      } else if (item.completedBy === "TEST_RUN") {
        if (testRun) completed = true;
      }

      return {
        ...item,
        completed,
      };
    });
  }, [flowState.metadata, nodes, testRun]);
  const [status, setStatus] = useState("Graph ready");
  const [flowInstance, setFlowInstance] =
    useState<ReactFlowInstance<AutomationFlowNode, Edge> | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const graphSnapshot = useMemo(
    () => toGraphSnapshot(nodes, edges),
    [edges, nodes],
  );
  const connectedSourceHandlesByNode = useMemo(() => {
    const map = new Map<string, Set<string>>();

    graphSnapshot.edges.forEach((edge) => {
      const sourceNode = graphSnapshot.nodes.find(
        (node) => node.id === edge.source,
      );
      if (!sourceNode) return;

      const sourceHandle = resolveSourceHandleId(
        sourceNode,
        edge.sourceHandle,
      );
      if (!sourceHandle) return;

      const handles = map.get(edge.source) ?? new Set<string>();
      handles.add(sourceHandle);
      map.set(edge.source, handles);
    });

    return map;
  }, [graphSnapshot]);
  const connectableNodeTypes = useMemo(
    () => automationNodeTypes.filter((type) => nodeCanReceiveInput(type)),
    [],
  );
  const filteredNodeAddTypes = useMemo(() => {
    const query = nodeAddSearch.trim().toLowerCase();

    if (!query) return connectableNodeTypes;

    return connectableNodeTypes.filter((type) => {
      const haystack = `${getAutomationNodeLabel(type)} ${getAutomationNodeDescription(
        type,
      )}`.toLowerCase();

      return haystack.includes(query);
    });
  }, [connectableNodeTypes, nodeAddSearch]);
  const nodeAddContext = useMemo(() => {
    if (!nodeAddPicker) return null;

    const sourceNode = nodes.find(
      (node) => node.id === nodeAddPicker.sourceNodeId,
    );
    if (!sourceNode) return null;

    const sourceGraphNode = toGraphNode(sourceNode);
    const outputHandle = getNodeOutputHandles(sourceGraphNode).find(
      (handle) => handle.id === nodeAddPicker.sourceHandle,
    );

    return {
      sourceLabel: String(sourceNode.data.label),
      sourceNode,
      sourcePathLabel: outputHandle?.label ?? nodeAddPicker.sourceHandle,
    };
  }, [nodeAddPicker, nodes]);

  const validation = useMemo(
    () => validateAutomationGraph(graphSnapshot),
    [graphSnapshot],
  );
  const graphKey = useMemo(
    () => JSON.stringify(graphSnapshot),
    [graphSnapshot],
  );
  const hasUnsavedDraftChanges = graphKey !== lastSavedGraphKey;
  const hasUnpublishedChanges = useMemo(
    () => detectUnpublishedChanges(graphSnapshot, publishedGraph),
    [graphSnapshot, publishedGraph],
  );
  const saveStateLabel = isSavingDraft
    ? "Saving"
    : hasUnsavedDraftChanges
      ? "Unsaved"
      : "Saved";
  const commitHistory = useCallback(
    (snapshot: AutomationGraph = graphSnapshot) => {
      const historyEntry = cloneGraph(snapshot);

      setHistoryState((current) => {
        const previous = current.past.at(-1);

        if (
          previous &&
          graphFingerprint(previous) === graphFingerprint(historyEntry)
        ) {
          return current;
        }

        return {
          future: [],
          past: [...current.past, historyEntry].slice(-MAX_GRAPH_HISTORY),
        };
      });
    },
    [graphSnapshot],
  );
  const canUndo = historyState.past.length > 0;
  const canRedo = historyState.future.length > 0;

  useEffect(() => {
    if (!hasUnsavedDraftChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedDraftChanges]);
  const statusBadgeLabel =
    flowState.status === "DRAFT" && !flowState.publishedVersionId
      ? "Draft only"
      : flowState.status === "PUBLISHED"
        ? "Published"
        : flowState.status === "PAUSED"
          ? "Paused"
          : "Archived";

  const testNodeStatusMap = useMemo(() => {
    const map = new Map<
      string,
      NonNullable<AutomationTestRun["steps"][number]["status"]>
    >();

    testRun?.steps.forEach((step) => {
      map.set(step.nodeId, step.status);
    });

    return map;
  }, [testRun?.steps]);

  const nodeIssueMap = useMemo(() => {
    const map = new Map<
      string,
      {
        count: number;
        severity: "ERROR" | "WARNING";
      }
    >();

    [...validation.errors, ...validation.warnings].forEach((issue) => {
      if (!issue.nodeId) return;

      const current = map.get(issue.nodeId);
      const severity =
        issue.severity === "ERROR" || current?.severity === "ERROR"
          ? "ERROR"
          : "WARNING";

      map.set(issue.nodeId, {
        count: (current?.count ?? 0) + 1,
        severity,
      });
    });

    return map;
  }, [validation.errors, validation.warnings]);

  const nodesWithValidation = useMemo(
    () =>
      nodes.map((node) => {
        const issues = nodeIssueMap.get(node.id);

        return {
          ...node,
          data: {
            ...node.data,
            testIsCurrent: testRun?.currentNodeId === node.id,
            testStatus: testNodeStatusMap.get(node.id),
            validationIssueCount: issues?.count,
            validationSeverity: issues?.severity,
          },
        };
      }),
    [nodeIssueMap, nodes, testNodeStatusMap, testRun?.currentNodeId],
  );

  const edgesWithTestState = useMemo(() => {
    const highlightedEdgeIds = new Set(testRun?.highlightedEdgeIds ?? []);

    return edges.map((edge) => {
      if (!highlightedEdgeIds.has(edge.id)) return edge;

      return {
        ...edge,
        animated: true,
        markerEnd: {
          color: "#22C55E",
          type: MarkerType.ArrowClosed,
        },
        style: {
          ...edge.style,
          stroke: "#22C55E",
          strokeWidth: 3,
        },
      };
    });
  }, [edges, testRun?.highlightedEdgeIds]);

  const onNodeClick: NodeMouseHandler<AutomationFlowNode> = useCallback(
    (_event, node) => {
      setSelectedNodeId(node.id);
      setIsDrawerOpen(true);
      setStatus(`${node.data.label} selected`);
    },
    [],
  );
  const openNodeAddPicker = useCallback(
    ({
      sourceHandle,
      sourceNodeId,
    }: {
      sourceHandle: string;
      sourceNodeId: string;
    }) => {
      const sourceNode = graphSnapshot.nodes.find(
        (node) => node.id === sourceNodeId,
      );
      if (!sourceNode) return;

      const resolvedSourceHandle = resolveSourceHandleId(
        sourceNode,
        sourceHandle,
      );
      if (!resolvedSourceHandle) {
        setStatus("Choose a source path first");
        return;
      }

      const alreadyConnected = graphSnapshot.edges.some((edge) => {
        if (edge.source !== sourceNodeId) return false;

        return (
          resolveSourceHandleId(sourceNode, edge.sourceHandle) ===
          resolvedSourceHandle
        );
      });

      if (alreadyConnected) {
        setStatus("This path is already connected");
        return;
      }

      setNodeAddPicker({
        sourceHandle: resolvedSourceHandle,
        sourceNodeId,
      });
      setNodeAddSearch("");
      setStatus("Choose the next node");
    },
    [graphSnapshot],
  );
  const builderNodeTypes = useMemo(
    () => ({
      automationNode: (props: NodeProps<AutomationFlowNode>) => (
        <NodeRenderer
          {...props}
          connectedSourceHandles={connectedSourceHandlesByNode.get(props.id)}
          onAddFromHandle={canEdit ? openNodeAddPicker : undefined}
        />
      ),
    }),
    [canEdit, connectedSourceHandlesByNode, openNodeAddPicker],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!canEdit) {
        setStatus("Read-only mode: editing is not available");
        return;
      }

      if (!connection.source || !connection.target) return;

      const check = canCreateConnection({
        graph: graphSnapshot,
        source: connection.source,
        sourceHandle: connection.sourceHandle,
        target: connection.target,
        targetHandle: connection.targetHandle,
      });

      if (!check.allowed) {
        setStatus(check.reason);
        return;
      }

      const edge: Edge = {
        ...connection,
        id: createId("edge"),
        label: check.label,
        markerEnd: {
          color: "#128C7E",
          type: MarkerType.ArrowClosed,
        },
        sourceHandle: check.sourceHandle,
        style: {
          stroke: "#128C7E",
          strokeWidth: 2,
        },
        targetHandle: check.targetHandle,
      };

      commitHistory();
      setEdges((currentEdges) => addEdge(edge, currentEdges));
      setStatus("Connection added");
    },
    [canEdit, commitHistory, graphSnapshot, setEdges],
  );

  function selectNode(nodeId: string) {
    const target = nodes.find((node) => node.id === nodeId);

    if (!target) return;

    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        selected: node.id === nodeId,
      })),
    );
    setSelectedNodeId(nodeId);
    setIsDrawerOpen(true);
    setStatus(`${target.data.label} selected`);
    flowInstance?.setCenter(target.position.x + 124, target.position.y + 80, {
      duration: 420,
      zoom: 1,
    });
  }

  function selectIssue(issue: AutomationGraphValidationIssue) {
    if (issue.nodeId) {
      selectNode(issue.nodeId);
      return;
    }

    if (issue.edgeId) {
      setStatus(`Issue selected: ${issue.edgeId}`);
    }
  }

  function applyGraphToCanvas(nextGraph: AutomationGraph) {
    const normalizedGraph = normalizeAutomationGraph(nextGraph);

    setNodes(normalizedGraph.nodes.map(toFlowNode));
    setEdges(normalizedGraph.edges.map(toFlowEdge));
    setSelectedNodeId(null);
    setIsDrawerOpen(false);
    setNodeAddPicker(null);
    setNodeAddSearch("");
  }

  function undoGraph() {
    if (!canUndo) {
      setStatus("Nothing to undo");
      return;
    }

    const previousGraph = historyState.past.at(-1);
    if (!previousGraph) return;

    setHistoryState((current) => ({
      future: [cloneGraph(graphSnapshot), ...current.future].slice(
        0,
        MAX_GRAPH_HISTORY,
      ),
      past: current.past.slice(0, -1),
    }));
    applyGraphToCanvas(previousGraph);
    setStatus("Undo");
  }

  function redoGraph() {
    if (!canRedo) {
      setStatus("Nothing to redo");
      return;
    }

    const nextGraph = historyState.future[0];
    if (!nextGraph) return;

    setHistoryState((current) => ({
      future: current.future.slice(1),
      past: [...current.past, cloneGraph(graphSnapshot)].slice(
        -MAX_GRAPH_HISTORY,
      ),
    }));
    applyGraphToCanvas(nextGraph);
    setStatus("Redo");
  }

  async function saveDraftToServer(showStatus = true) {
    setIsSavingDraft(true);

    try {
      const data = await readAutomationJson<{
        flow: {
          publishedVersionId: string | null;
          status: AutomationBuilderFlowStatus;
          updatedAt: string;
        };
        hasUnpublishedChanges: boolean;
        validation: {
          errors: unknown[];
          warnings: unknown[];
        };
      }>(
        await fetch(`/api/automation/flows/${encodeURIComponent(flowId)}/draft`, {
          body: JSON.stringify({
            graph: graphSnapshot,
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "PATCH",
        }),
      );

      setFlowState((current) => ({
        ...current,
        hasUnpublishedChanges: data.hasUnpublishedChanges,
        publishedVersionId: data.flow.publishedVersionId,
        status: data.flow.status,
        updatedAt: data.flow.updatedAt,
      }));
      setLastSavedGraphKey(graphKey);
      setLastSavedAt(data.flow.updatedAt);

      if (showStatus) {
        setStatus(
          data.validation.errors.length > 0
            ? "Draft saved with validation errors"
            : "Draft saved",
        );
      }

      return data;
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to save draft";
      setStatus(message);
      throw caught;
    } finally {
      setIsSavingDraft(false);
    }
  }

  function saveDraft() {
    if (!canEdit) {
      setStatus("Read-only mode: editing is not available");
      return;
    }

    void saveDraftToServer();
  }

  function openPublishModal() {
    setPublishError(null);
    setPublishWarningsAccepted(false);
    setIsPublishModalOpen(true);
  }

  async function publishFlow() {
    if (validation.errors.length > 0) {
      setPublishError("Fix validation errors before publishing");
      return;
    }

    setIsPublishing(true);
    setPublishError(null);

    try {
      await saveDraftToServer(false);

      const data = await readAutomationJson<{
        flow: {
          publishedAt: string | null;
          publishedVersionId: string | null;
          status: AutomationBuilderFlowStatus;
        };
        version: {
          id: string;
          publishedAt: string;
          versionNumber: number;
        };
      }>(
        await fetch(`/api/automation/flows/${encodeURIComponent(flowId)}/publish`, {
          body: JSON.stringify({
            allowWarnings: publishWarningsAccepted,
            publishNotes,
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        }),
      );

      setPublishedGraph(graphSnapshot);
      setFlowState((current) => ({
        ...current,
        currentVersionNumber: data.version.versionNumber,
        hasUnpublishedChanges: false,
        publishedAt: data.flow.publishedAt,
        publishedGraph: graphSnapshot,
        publishedVersionId: data.flow.publishedVersionId,
        status: data.flow.status,
      }));
      setIsPublishModalOpen(false);
      setPublishNotes("");
      setStatus(`Published Version ${data.version.versionNumber}`);
    } catch (caught) {
      setPublishError(
        caught instanceof Error ? caught.message : "Unable to publish flow",
      );
    } finally {
      setIsPublishing(false);
    }
  }

  async function changeFlowStatus(action: "pause" | "resume") {
    setIsChangingStatus(true);

    try {
      const data = await readAutomationJson<{
        flow: {
          status: AutomationBuilderFlowStatus;
        };
      }>(
        await fetch(`/api/automation/flows/${encodeURIComponent(flowId)}/${action}`, {
          method: "POST",
        }),
      );

      setFlowState((current) => ({
        ...current,
        status: data.flow.status,
      }));
      setStatus(action === "pause" ? "Flow paused" : "Flow resumed");
    } catch (caught) {
      setStatus(
        caught instanceof Error ? caught.message : `Unable to ${action} flow`,
      );
    } finally {
      setIsChangingStatus(false);
    }
  }

  function handleRollback(result: AutomationRollbackResult) {
    const normalizedGraph = normalizeAutomationGraph(result.graph);

    commitHistory();
    applyGraphToCanvas(normalizedGraph);
    setPublishedGraph(normalizedGraph);
    setHistoryState({
      future: [],
      past: [],
    });
    setLastSavedGraphKey(graphFingerprint(normalizedGraph));
    setLastSavedAt(new Date().toISOString());
    setFlowState((current) => ({
      ...current,
      currentVersionNumber: result.version.versionNumber,
      hasUnpublishedChanges: false,
      publishedAt: result.flow.publishedAt,
      publishedGraph: normalizedGraph,
      publishedVersionId: result.flow.publishedVersionId,
      status: result.flow.status,
    }));
    setStatus(`Rolled back into Version ${result.version.versionNumber}`);
  }

  function addNode(type: AutomationNodeType) {
    if (!canEdit) {
      setStatus("Read-only mode: editing is not available");
      return;
    }

    const node = createFlowNode(type, calculateNewPosition(nodes.length + 1));

    commitHistory();
    setNodes((currentNodes) => [
      ...currentNodes.map((currentNode) => ({
        ...currentNode,
        selected: false,
      })),
      node,
    ]);
    setSelectedNodeId(node.id);
    setIsDrawerOpen(true);
    setStatus(`${getAutomationNodeLabel(type)} added`);
  }

  function addConnectedNode(type: AutomationNodeType) {
    if (!nodeAddPicker) return;

    if (!canEdit) {
      setStatus("Read-only mode: editing is not available");
      return;
    }

    if (!isAutomationNodeTypeEnabled(type)) {
      setStatus(`${getAutomationNodeLabel(type)} is not enabled`);
      return;
    }

    if (planLimits?.allowedNodes && !planLimits.allowedNodes.includes(type)) {
      setLockedModalNodeType(type);
      return;
    }

    const sourceNode = nodes.find(
      (node) => node.id === nodeAddPicker.sourceNodeId,
    );
    if (!sourceNode) {
      setStatus("Source node was removed");
      setNodeAddPicker(null);
      return;
    }

    const newNode = createFlowNode(
      type,
      calculateConnectedPosition({
        existingNodes: nodes,
        sourceHandle: nodeAddPicker.sourceHandle,
        sourceNode,
      }),
    );
    const prospectiveGraph: AutomationGraph = {
      ...graphSnapshot,
      nodes: [...graphSnapshot.nodes, toGraphNode(newNode)],
    };
    const check = canCreateConnection({
      graph: prospectiveGraph,
      source: sourceNode.id,
      sourceHandle: nodeAddPicker.sourceHandle,
      target: newNode.id,
      targetHandle: "input",
    });

    if (!check.allowed) {
      setStatus(check.reason);
      return;
    }

    const edge: Edge = {
      id: createId("edge"),
      label: check.label,
      markerEnd: {
        color: "#128C7E",
        type: MarkerType.ArrowClosed,
      },
      source: sourceNode.id,
      sourceHandle: check.sourceHandle,
      style: {
        stroke: "#128C7E",
        strokeWidth: 2,
      },
      target: newNode.id,
      targetHandle: check.targetHandle,
    };

    commitHistory();
    setNodes((currentNodes) => [
      ...currentNodes.map((node) => ({
        ...node,
        selected: false,
      })),
      newNode,
    ]);
    setEdges((currentEdges) => addEdge(edge, currentEdges));
    setSelectedNodeId(newNode.id);
    setIsDrawerOpen(true);
    setNodeAddPicker(null);
    setNodeAddSearch("");
    setStatus(
      `${getAutomationNodeLabel(type)} added on ${check.label ?? "next"} path`,
    );
    flowInstance?.setCenter(newNode.position.x + 124, newNode.position.y + 80, {
      duration: 420,
      zoom: 1,
    });
  }

  function saveNode(nodeId: string, data: AutomationNodeData) {
    if (!canEdit) {
      setStatus("Read-only mode: editing is not available");
      return;
    }

    const currentNode = nodes.find((node) => node.id === nodeId);
    const updatedNode = currentNode
      ? {
          ...currentNode,
          data: {
            ...currentNode.data,
            ...data,
            nodeType: currentNode.data.nodeType,
          },
        }
      : null;
    const updatedGraphNode = updatedNode ? toGraphNode(updatedNode) : null;

    commitHistory();
    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                ...data,
                nodeType: node.data.nodeType,
              },
            }
          : node,
      ),
    );

    if (updatedGraphNode) {
      const outputHandleIds = new Set(
        getNodeOutputHandles(updatedGraphNode).map((handle) => handle.id),
      );

      setEdges((currentEdges) =>
        currentEdges
          .filter((edge) => {
            if (edge.source !== nodeId) return true;

            const sourceHandle = resolveSourceHandleId(
              updatedGraphNode,
              edge.sourceHandle,
            );

            return Boolean(
              sourceHandle && outputHandleIds.has(sourceHandle),
            );
          })
          .map((edge) => {
            if (edge.source !== nodeId) return edge;

            const sourceHandle = resolveSourceHandleId(
              updatedGraphNode,
              edge.sourceHandle,
            );

            return {
              ...edge,
              label:
                getEdgeLabelForSourceHandle(updatedGraphNode, sourceHandle) ??
                edge.label,
              sourceHandle,
            };
          }),
      );
    }

    setStatus("Node settings saved");
  }

  function deleteNode(nodeId: string) {
    if (!canEdit) {
      setStatus("Read-only mode: editing is not available");
      return;
    }

    commitHistory();
    setNodes((currentNodes) =>
      currentNodes.filter((node) => node.id !== nodeId),
    );
    setEdges((currentEdges) =>
      currentEdges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId,
      ),
    );
    setSelectedNodeId(null);
    setIsDrawerOpen(false);
    setStatus("Node deleted");
  }

  function duplicateNode(nodeId: string) {
    if (!canEdit) {
      setStatus("Read-only mode: editing is not available");
      return;
    }

    const sourceNode = nodes.find((node) => node.id === nodeId);
    if (!sourceNode) return;

    const id = createId(`node_${sourceNode.data.nodeType.toLowerCase()}`);
    const duplicate: AutomationFlowNode = {
      ...sourceNode,
      data: {
        ...sourceNode.data,
        label: `${sourceNode.data.label} copy`,
      },
      id,
      position: {
        x: sourceNode.position.x + 48,
        y: sourceNode.position.y + 48,
      },
      selected: true,
    };

    commitHistory();
    setNodes((currentNodes) => [
      ...currentNodes.map((node) => ({
        ...node,
        selected: false,
      })),
      duplicate,
    ]);
    setSelectedNodeId(id);
    setIsDrawerOpen(true);
    setStatus("Node duplicated");
  }

  function requestDeleteSelectedNode() {
    if (!canEdit) {
      setStatus("Read-only mode: editing is not available");
      return;
    }

    if (!selectedNode) {
      setStatus("Select a node first");
      return;
    }

    const confirmed = window.confirm(
      `Delete "${selectedNode.data.label}" from this automation graph?`,
    );

    if (confirmed) {
      deleteNode(selectedNode.id);
    }
  }

  function duplicateSelectedNode() {
    if (!canEdit) {
      setStatus("Read-only mode: editing is not available");
      return;
    }

    if (!selectedNode) {
      setStatus("Select a node first");
      return;
    }

    duplicateNode(selectedNode.id);
  }

  const onNodeDragStart = useCallback(() => {
    if (!canEdit) return;

    dragStartGraphRef.current = cloneGraph(graphSnapshot);
  }, [canEdit, graphSnapshot]);

  const onNodeDragStop = useCallback(() => {
    const startGraph = dragStartGraphRef.current;
    dragStartGraphRef.current = null;

    if (!canEdit || !startGraph) return;

    if (graphFingerprint(startGraph) !== graphFingerprint(graphSnapshot)) {
      commitHistory(startGraph);
      setStatus("Node moved");
    }
  }, [canEdit, commitHistory, graphSnapshot]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const editingText = isTextEditingTarget(event.target);

      if (event.key === "Escape") {
        setNodeAddPicker(null);
        setIsDrawerOpen(false);
        return;
      }

      if (isModifier && key === "s") {
        event.preventDefault();
        saveDraft();
        return;
      }

      if (isModifier && key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redoGraph();
        } else {
          undoGraph();
        }
        return;
      }

      if (isModifier && key === "y") {
        event.preventDefault();
        redoGraph();
        return;
      }

      if (editingText) return;

      if (isModifier && key === "d") {
        event.preventDefault();
        duplicateSelectedNode();
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        requestDeleteSelectedNode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  const isFullscreen = layout === "fullscreen";
  const shouldShowDrawer = isDrawerOpen && Boolean(selectedNode);
  const builderShellClass = isFullscreen
    ? [
        "grid h-full min-h-0 grid-cols-1 gap-3 overflow-y-auto p-3 xl:overflow-hidden",
        shouldShowDrawer
          ? "xl:grid-cols-[220px_minmax(0,1fr)_400px]"
          : "xl:grid-cols-[220px_minmax(0,1fr)]",
      ].join(" ")
    : [
        "grid gap-5",
        shouldShowDrawer
          ? "xl:grid-cols-[260px_minmax(0,1fr)_430px]"
          : "xl:grid-cols-[260px_minmax(0,1fr)]",
      ].join(" ");
  const paletteColumnClass = isFullscreen
    ? "max-h-72 min-h-0 overflow-hidden xl:h-full xl:max-h-none"
    : "w-80 shrink-0";
  const canvasFrameClass = isFullscreen
    ? "flex min-h-[680px] flex-col overflow-hidden rounded-2xl border border-[#BFE9D0] bg-[#F7FBFF] shadow-[0_18px_44px_rgba(8,27,58,0.08)] xl:h-full xl:min-h-0"
    : "min-w-0 overflow-hidden rounded-2xl border border-[#BFE9D0] bg-[#F7FBFF] shadow-[0_18px_44px_rgba(8,27,58,0.08)]";
  const canvasViewportClass = isFullscreen ? "min-h-0 flex-1" : "h-[720px]";

  return (
    <ReactFlowProvider>
      <section className={builderShellClass}>
        <div className={paletteColumnClass}>
          <NodePalette
            onAddNode={addNode}
            allowedNodes={planLimits?.allowedNodes}
            disabled={!canEdit}
            onLockedNodeClick={(nodeType) => setLockedModalNodeType(nodeType)}
            variant={isFullscreen ? "compact" : "default"}
          />
        </div>

        <div className={canvasFrameClass}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#BFE9D0] bg-white px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E7F8EF] text-[#128C7E]">
                <Workflow className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-bold text-[#081B3A]">
                  Visual automation canvas
                </p>
                <p className="mt-1 text-xs text-[#526173]">
                  {nodes.length.toLocaleString("en-IN")} nodes,{" "}
                  {edges.length.toLocaleString("en-IN")} connections -{" "}
                  Version {flowState.currentVersionNumber ?? "draft"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={[
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                  flowState.status === "PAUSED"
                    ? "bg-amber-100 text-amber-700"
                    : flowState.status === "ARCHIVED"
                      ? "bg-slate-100 text-slate-600"
                      : flowState.status === "PUBLISHED"
                        ? "bg-[#E7F8EF] text-[#128C7E]"
                        : "bg-blue-50 text-blue-700",
                ].join(" ")}
              >
                {statusBadgeLabel}
              </span>
              <span
                className={[
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                  flowState.publishedVersionId && !hasUnpublishedChanges
                    ? "bg-[#E7F8EF] text-[#128C7E]"
                    : "bg-amber-100 text-amber-700",
                ].join(" ")}
              >
                {flowState.publishedVersionId
                  ? hasUnpublishedChanges
                    ? "Unpublished changes"
                    : "Published version is up to date"
                  : "Draft only"}
              </span>
              <span
                className={[
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                  validation.errors.length > 0
                    ? "bg-rose-100 text-rose-700"
                    : validation.warnings.length > 0
                      ? "bg-amber-100 text-amber-700"
                      : "bg-[#E7F8EF] text-[#128C7E]",
                ].join(" ")}
              >
                {validation.errors.length > 0 ? (
                  <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                {validation.errors.length === 0 &&
                validation.warnings.length === 0
                  ? "Valid flow"
                  : `${validation.errors.length} errors, ${validation.warnings.length} warnings`}
              </span>
              {!canEdit ? (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  <Lock className="mr-1.5 h-3.5 w-3.5" />
                  Read-only
                </span>
              ) : null}
              <span
                className={[
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                  hasUnsavedDraftChanges
                    ? "bg-amber-100 text-amber-700"
                    : "bg-[#E7F8EF] text-[#128C7E]",
                ].join(" ")}
                title={lastSavedAt ? `Last saved ${lastSavedAt}` : undefined}
              >
                {hasUnsavedDraftChanges ? (
                  <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                {saveStateLabel}
              </span>
              {usageSummary ? (
                <>
                  <span className="inline-flex items-center rounded-full bg-[#E7F8EF] px-3 py-1 text-xs font-semibold text-[#128C7E]">
                    {usageSummary.usage.flowsUsed.toLocaleString("en-IN")}/
                    {usageSummary.limits.flows === null
                      ? "∞"
                      : usageSummary.limits.flows.toLocaleString("en-IN")}{" "}
                    flows
                  </span>
                  <span className="inline-flex items-center rounded-full bg-[#E7F8EF] px-3 py-1 text-xs font-semibold text-[#128C7E]">
                    {usageSummary.usage.executionsUsed.toLocaleString("en-IN")}/
                    {usageSummary.limits.executions === null
                      ? "∞"
                      : usageSummary.limits.executions.toLocaleString("en-IN")}{" "}
                    executions
                  </span>
                </>
              ) : null}
              <div className="flex items-center rounded-xl border border-[#BFE9D0] bg-white p-1">
                <button
                  className="grid h-8 w-8 place-items-center rounded-lg text-[#128C7E] transition hover:bg-[#E7F8EF] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!canUndo}
                  onClick={undoGraph}
                  title="Undo (Ctrl+Z)"
                  type="button"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
                <button
                  className="grid h-8 w-8 place-items-center rounded-lg text-[#128C7E] transition hover:bg-[#E7F8EF] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!canRedo}
                  onClick={redoGraph}
                  title="Redo (Ctrl+Y)"
                  type="button"
                >
                  <Redo2 className="h-4 w-4" />
                </button>
              </div>
              {selectedNode ? (
                <div className="flex items-center rounded-xl border border-[#BFE9D0] bg-white p-1">
                  <button
                    className="grid h-8 w-8 place-items-center rounded-lg text-[#128C7E] transition hover:bg-[#E7F8EF] disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!canEdit}
                    onClick={duplicateSelectedNode}
                    title="Duplicate selected node (Ctrl+D)"
                    type="button"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <button
                    className="grid h-8 w-8 place-items-center rounded-lg text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!canEdit}
                    onClick={requestDeleteSelectedNode}
                    title="Delete selected node (Delete)"
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
              <button
                className="inline-flex items-center rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#E7F8EF] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canEdit || isSavingDraft || !hasUnsavedDraftChanges}
                onClick={saveDraft}
                title="Save draft (Ctrl+S)"
                type="button"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {isSavingDraft ? "Saving" : "Save Draft"}
              </button>
              <button
                className="inline-flex items-center rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#E7F8EF]"
                onClick={() => setIsTestPanelOpen(true)}
                type="button"
              >
                <TestTube2 className="mr-1.5 h-3.5 w-3.5" />
                Test Flow
              </button>
              <button
                className="inline-flex items-center rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#E7F8EF]"
                onClick={() => setIsVersionHistoryOpen(true)}
                type="button"
              >
                <History className="mr-1.5 h-3.5 w-3.5" />
                Version History
              </button>
              {flowState.publishedVersionId ? (
                <button
                  className="inline-flex items-center rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#E7F8EF] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isChangingStatus}
                  onClick={() =>
                    changeFlowStatus(
                      flowState.status === "PAUSED" ? "resume" : "pause",
                    )
                  }
                  type="button"
                >
                  {flowState.status === "PAUSED" ? (
                    <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                  ) : (
                    <PauseCircle className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {flowState.status === "PAUSED" ? "Resume" : "Pause"}
                </button>
              ) : null}
              {canPublish ? (
                <button
                  className="inline-flex items-center rounded-xl bg-[#128C7E] px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(18,140,126,0.18)] transition hover:bg-[#075E54] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isPublishing}
                  onClick={openPublishModal}
                  type="button"
                >
                  <Rocket className="mr-1.5 h-3.5 w-3.5" />
                  {isPublishing ? "Publishing" : "Publish"}
                </button>
              ) : canRequestPublish ? (
                <button
                  className="inline-flex items-center rounded-xl bg-[#0052CC] px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(0,82,204,0.18)] transition hover:bg-[#0040A3] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setIsRequestModalOpen(true)}
                  type="button"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  Request Approval
                </button>
              ) : null}
            </div>
          </div>

          {checklist.length > 0 ? (
            <div className="bg-white border-b border-[#BFE9D0] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[#081B3A]">
                    Template Setup Checklist ({checklist.filter(c => c.completed).length}/{checklist.length})
                  </span>
                  <span className="text-[10px] text-[#526173]">
                    Created from {(flowState.metadata as ChecklistMetadata)?.sourceTemplateName}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChecklistCollapsed(!isChecklistCollapsed)}
                  className="text-xs font-semibold text-[#0052CC] hover:underline"
                >
                  {isChecklistCollapsed ? "Show Checklist" : "Hide Checklist"}
                </button>
              </div>

              {!isChecklistCollapsed && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {checklist.map((item) => (
                    <div
                      key={item.key}
                      className={[
                        "p-3 rounded-lg border flex items-start gap-2.5",
                        item.completed
                          ? "bg-emerald-50/50 border-emerald-100 text-emerald-800"
                          : "bg-slate-50 border-slate-200 text-slate-700",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        readOnly
                        className="mt-0.5 pointer-events-none rounded border-slate-300 text-[#128C7E] focus:ring-[#128C7E]"
                      />
                      <div>
                        <p className="text-xs font-bold leading-none">{item.title}</p>
                        <p className="text-[10px] text-[#526173] mt-1 leading-normal">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {currentDraftLockedNodes.length > 0 && (
            <div className="p-3 border-b border-[#BFE9D0] bg-white">
              <UpgradeRequiredBanner
                title="Plan Limit Warning"
                message={`This flow draft contains ${currentDraftLockedNodes.length} node(s) (${currentDraftLockedNodes.join(", ")}) not included in your current ${planLimits?.planName || "Starter"} plan. Upgrade or remove them before publishing.`}
              />
            </div>
          )}

          <div className={canvasViewportClass}>
            <ReactFlow
              colorMode="light"
              defaultEdgeOptions={{
                markerEnd: {
                  color: "#128C7E",
                  type: MarkerType.ArrowClosed,
                },
                style: {
                  stroke: "#128C7E",
                  strokeWidth: 2,
                },
              }}
              deleteKeyCode={null}
              edges={edgesWithTestState}
              fitView
              fitViewOptions={{
                maxZoom: 1,
                padding: 0.24,
              }}
              minZoom={0.35}
              nodeTypes={builderNodeTypes}
              nodes={nodesWithValidation}
              nodesDraggable={canEdit}
              nodesConnectable={canEdit}
              elementsSelectable={true}
              onInit={setFlowInstance}
              onConnect={onConnect}
              onEdgesChange={onEdgesChange}
              onNodeDragStart={onNodeDragStart}
              onNodeDragStop={onNodeDragStop}
              onNodeClick={onNodeClick}
              onNodesChange={onNodesChange}
              proOptions={{
                hideAttribution: true,
              }}
            >
              <Background
                color="#BFE9D0"
                gap={22}
                size={1}
                variant={BackgroundVariant.Dots}
              />
              <Controls
                className="!border !border-[#BFE9D0] !bg-white !shadow-[0_12px_28px_rgba(8,27,58,0.12)]"
                position="bottom-left"
              />
              <MiniMap
                maskColor="rgba(8, 27, 58, 0.07)"
                nodeColor="#128C7E"
                nodeStrokeWidth={3}
                pannable
                position="bottom-right"
                zoomable
              />
              <ReactFlowPanel position="top-left">
                <div className="flex items-center gap-2 rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-xs font-semibold text-[#081B3A] shadow-[0_12px_28px_rgba(8,27,58,0.10)]">
                  <Save className="h-4 w-4 text-[#128C7E]" />
                  {status}
                </div>
              </ReactFlowPanel>
              {nodeAddPicker ? (
                <ReactFlowPanel position="top-right">
                  <div className="w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-[#BFE9D0] bg-white p-3 shadow-[0_22px_60px_rgba(8,27,58,0.18)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-normal text-[#128C7E]">
                          Add next node
                        </p>
                        <p className="mt-1 truncate text-sm font-bold text-[#081B3A]">
                          {nodeAddContext?.sourceLabel ?? "Selected path"}
                        </p>
                        <p className="mt-0.5 text-xs text-[#526173]">
                          Path: {nodeAddContext?.sourcePathLabel ?? "Next"}
                        </p>
                      </div>
                      <button
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[#BFE9D0] text-[#128C7E] transition hover:bg-[#E7F8EF]"
                        onClick={() => setNodeAddPicker(null)}
                        type="button"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <label className="mt-3 flex items-center gap-2 rounded-xl border border-[#BFE9D0] bg-[#F8FCFA] px-3 py-2 text-sm text-[#081B3A]">
                      <Search className="h-4 w-4 shrink-0 text-[#526173]" />
                      <input
                        autoFocus
                        className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#8A94A6]"
                        onChange={(event) => setNodeAddSearch(event.target.value)}
                        placeholder="Search nodes"
                        value={nodeAddSearch}
                      />
                    </label>

                    <div className="mt-3 max-h-[420px] space-y-1 overflow-y-auto pr-1">
                      {filteredNodeAddTypes.length > 0 ? (
                        filteredNodeAddTypes.map((type) => {
                          const isFeatureEnabled =
                            isAutomationNodeTypeEnabled(type);
                          const isPlanAllowed = planLimits?.allowedNodes
                            ? planLimits.allowedNodes.includes(type)
                            : true;
                          const isAvailable = isFeatureEnabled && isPlanAllowed;

                          return (
                            <button
                              className={[
                                "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition",
                                isAvailable
                                  ? "border-transparent hover:border-[#BFE9D0] hover:bg-[#E7F8EF]"
                                  : "border-slate-100 bg-slate-50 text-slate-400",
                              ].join(" ")}
                              key={type}
                              onClick={() => addConnectedNode(type)}
                              type="button"
                            >
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#E7F8EF] text-[#128C7E]">
                                <PlusCircle className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-bold text-[#081B3A]">
                                  {getAutomationNodeLabel(type)}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-[#526173]">
                                  {isFeatureEnabled
                                    ? getAutomationNodeDescription(type)
                                    : "This node is not enabled"}
                                </span>
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="rounded-xl border border-dashed border-[#BFE9D0] p-4 text-sm text-[#526173]">
                          No matching nodes found.
                        </div>
                      )}
                    </div>
                  </div>
                </ReactFlowPanel>
              ) : null}
            </ReactFlow>
          </div>
        </div>

        {shouldShowDrawer ? (
          <NodeEditingDrawer
            isOpen={isDrawerOpen}
            layout={layout}
            node={selectedNode}
            nodes={nodes}
            onClose={() => setIsDrawerOpen(false)}
            onDelete={deleteNode}
            onDuplicate={duplicateNode}
            onSave={saveNode}
            readOnly={!canEdit}
          />
        ) : null}
      </section>

      <AutomationTestPanel
        flowId={flowId}
        graph={graphSnapshot}
        graphKey={graphKey}
        isOpen={isTestPanelOpen}
        onClose={() => setIsTestPanelOpen(false)}
        onSelectNode={selectNode}
        onTestRunChange={setTestRun}
        testRun={testRun}
      />

      <AutomationVersionHistoryPanel
        flowId={flowId}
        isOpen={isVersionHistoryOpen}
        onClose={() => setIsVersionHistoryOpen(false)}
        onRollback={handleRollback}
      />

      {isPublishModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#081B3A]/45 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-[0_22px_70px_rgba(8,27,58,0.28)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-[#081B3A]">
                  Publish {flowState.name}
                </p>
                <p className="mt-1 text-sm text-[#526173]">
                  New version:{" "}
                  {(flowState.currentVersionNumber ?? 0) + 1}. Existing sessions
                  stay on their current version.
                </p>
              </div>
              <button
                className="rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-xs font-semibold text-[#128C7E]"
                onClick={() => setIsPublishModalOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-xl border border-[#D6EADF] bg-[#F7FBFF] p-4">
                <p className="text-sm font-bold text-[#081B3A]">
                  Validation summary
                </p>
                <p className="mt-1 text-sm text-[#526173]">
                  {validation.errors.length} errors, {validation.warnings.length}{" "}
                  warnings
                </p>
              </div>

              {validation.errors.length > 0 ? (
                <div className="grid gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm font-bold text-rose-700">
                    Publish blocked
                  </p>
                  {validation.errors.map((issue, index) => (
                    <p
                      className="text-sm leading-5 text-rose-700"
                      key={validationIssueKey(issue, index, "publish-error")}
                    >
                      {issue.message}
                    </p>
                  ))}
                </div>
              ) : null}

              {validation.warnings.length > 0 ? (
                <div className="grid gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-800">
                    Warnings need confirmation
                  </p>
                  {validation.warnings.map((issue, index) => (
                    <p
                      className="text-sm leading-5 text-amber-800"
                      key={validationIssueKey(issue, index, "publish-warning")}
                    >
                      {issue.message}
                    </p>
                  ))}
                  <label className="mt-2 flex items-start gap-2 text-sm font-semibold text-amber-800">
                    <input
                      checked={publishWarningsAccepted}
                      className="mt-1"
                      onChange={(event) =>
                        setPublishWarningsAccepted(event.target.checked)
                      }
                      type="checkbox"
                    />
                    Publish with warnings
                  </label>
                </div>
              ) : null}

              <label className="grid gap-1.5 text-xs font-semibold text-[#526173]">
                Publish notes
                <textarea
                  className="min-h-24 rounded-xl border border-[#BFE9D0] px-3 py-2 text-sm text-[#081B3A] outline-none focus:border-[#128C7E]"
                  onChange={(event) => setPublishNotes(event.target.value)}
                  placeholder="What changed in this version?"
                  value={publishNotes}
                />
              </label>

              {publishError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                  {publishError}
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                className="rounded-xl border border-[#BFE9D0] bg-white px-4 py-2 text-sm font-semibold text-[#128C7E]"
                onClick={() => setIsPublishModalOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-[#128C7E] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  isPublishing ||
                  validation.errors.length > 0 ||
                  (validation.warnings.length > 0 && !publishWarningsAccepted)
                }
                onClick={publishFlow}
                type="button"
              >
                Publish version {(flowState.currentVersionNumber ?? 0) + 1}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!isFullscreen ? (
      <div className="mt-5 rounded-2xl border border-[#BFE9D0] bg-white p-5 shadow-[0_14px_34px_rgba(8,27,58,0.07)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-[#081B3A]">Graph structure</p>
            <p className="mt-1 text-xs text-[#526173]">
              Backward-compatible node shape is maintained in memory.
            </p>
          </div>
          <span className="rounded-full bg-[#E7F8EF] px-3 py-1 text-xs font-semibold text-[#128C7E]">
            {graphSnapshot.nodes.length} nodes
          </span>
        </div>
        {validation.errors.length > 0 || validation.warnings.length > 0 ? (
          <div className="mt-4 grid gap-2">
            {[...validation.errors, ...validation.warnings].map((issue, index) => (
              <button
                className={[
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition",
                  issue.severity === "ERROR"
                    ? "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
                    : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
                ].join(" ")}
                key={validationIssueKey(issue, index, "graph-structure")}
                onClick={() => selectIssue(issue)}
                type="button"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-xs font-bold uppercase tracking-normal">
                    {issue.code}
                  </span>
                  <span className="mt-1 block text-sm">{issue.message}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
        <pre className="mt-4 max-h-72 overflow-auto rounded-xl bg-[#081B3A] p-4 text-xs leading-5 text-[#DFF8EB]">
          {JSON.stringify(graphSnapshot, null, 2)}
        </pre>
      </div>
      ) : null}
      <RequestPublishModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSubmit={async (publishNotes) => {
          const res = await fetch(`/api/automation/flows/${flowId}/publish-requests`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ publishNotes }),
          });

          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.message || "Failed to submit publish approval request.");
          }

          setStatus("Publish approval requested!");
        }}
      />
      <LockedNodeModal
        isOpen={Boolean(lockedModalNodeType)}
        nodeType={lockedModalNodeType}
        nodeLabel={
          lockedModalNodeType
            ? getAutomationNodeLabel(lockedModalNodeType as AutomationNodeType)
            : ""
        }
        requiredPlan={
          planLimits?.lockedNodes.find((l) => l.nodeType === lockedModalNodeType)?.requiredPlan || "PRO"
        }
        onClose={() => setLockedModalNodeType(null)}
      />
    </ReactFlowProvider>
  );
}
