"use client";

import { useCallback, useMemo, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
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
  Rocket,
  Save,
  TestTube2,
  Workflow,
} from "lucide-react";
import AutomationTestPanel from "@/components/automation-builder/automation-test-panel";
import type { AutomationTestRun } from "@/components/automation-builder/automation-test-types";
import NodeEditingDrawer from "@/components/automation-builder/node-editing-drawer";
import NodePalette from "@/components/automation-builder/node-palette";
import NodeRenderer, {
  type AutomationFlowNode,
} from "@/components/automation-builder/node-renderer";
import {
  createDefaultAutomationGraph,
  createDefaultNodeData,
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
  getNodeOutputHandles,
  resolveSourceHandleId,
} from "@/lib/automation-builder/connection-handles";
import { validateAutomationGraph } from "@/lib/automation-builder/graph-validation";
import type { AutomationGraphValidationIssue } from "@/lib/automation-builder/types";

type AutomationBuilderProps = {
  flowId: string;
  initialGraph?: AutomationGraph;
};

const nodeTypes = {
  automationNode: NodeRenderer,
};

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }

  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
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

function calculateNewPosition(count: number) {
  return {
    x: 140 + (count % 4) * 300,
    y: 120 + Math.floor(count / 4) * 170,
  };
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
  initialGraph,
}: AutomationBuilderProps) {
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
  const [nodes, setNodes, onNodesChange] =
    useNodesState<AutomationFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isTestPanelOpen, setIsTestPanelOpen] = useState(false);
  const [testRun, setTestRun] = useState<AutomationTestRun | null>(null);
  const [status, setStatus] = useState("Graph ready");
  const [flowInstance, setFlowInstance] =
    useState<ReactFlowInstance<AutomationFlowNode, Edge> | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const graphSnapshot = useMemo(
    (): AutomationGraph => ({
      edges: edges.map((edge) => ({
        id: edge.id,
        label: typeof edge.label === "string" ? edge.label : undefined,
        sourceHandle: edge.sourceHandle ?? undefined,
        source: edge.source,
        targetHandle: edge.targetHandle ?? undefined,
        target: edge.target,
      })),
      nodes: nodes.map(toGraphNode),
      version: 1,
    }),
    [edges, nodes],
  );

  const validation = useMemo(
    () => validateAutomationGraph(graphSnapshot),
    [graphSnapshot],
  );
  const graphKey = useMemo(
    () => JSON.stringify(graphSnapshot),
    [graphSnapshot],
  );

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

  const onConnect = useCallback(
    (connection: Connection) => {
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

      setEdges((currentEdges) => addEdge(edge, currentEdges));
      setStatus("Connection added");
    },
    [graphSnapshot, setEdges],
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

  function saveDraft() {
    setStatus(
      validation.errors.length > 0
        ? "Draft saved locally with validation errors"
        : "Draft saved locally",
    );
  }

  function publishFlow() {
    if (validation.errors.length > 0) {
      setStatus("Fix validation errors before publishing");
      return;
    }

    setStatus("Flow is ready for publish API integration");
  }

  function addNode(type: AutomationNodeType) {
    const id = createId(`node_${type.toLowerCase()}`);
    const data = createDefaultNodeData(type);
    const node: AutomationFlowNode = {
      data: {
        ...data,
        label: data.label || getAutomationNodeLabel(type),
        nodeType: type,
      },
      id,
      position: calculateNewPosition(nodes.length + 1),
      selected: true,
      type: "automationNode",
    };

    setNodes((currentNodes) => [
      ...currentNodes.map((currentNode) => ({
        ...currentNode,
        selected: false,
      })),
      node,
    ]);
    setSelectedNodeId(id);
    setIsDrawerOpen(true);
    setStatus(`${getAutomationNodeLabel(type)} added`);
  }

  function saveNode(nodeId: string, data: AutomationNodeData) {
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

  return (
    <ReactFlowProvider>
      <section className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_430px]">
        <NodePalette onAddNode={addNode} />

        <div className="min-w-0 overflow-hidden rounded-2xl border border-[#BFE9D0] bg-[#F7FBFF] shadow-[0_18px_44px_rgba(8,27,58,0.08)]">
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
                  {edges.length.toLocaleString("en-IN")} connections - {flowId}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
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
              <button
                className="inline-flex items-center rounded-xl border border-[#BFE9D0] bg-white px-3 py-2 text-xs font-semibold text-[#128C7E] transition hover:bg-[#E7F8EF]"
                onClick={saveDraft}
                type="button"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Save Draft
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
                className="inline-flex items-center rounded-xl bg-[#128C7E] px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_22px_rgba(18,140,126,0.18)] transition hover:bg-[#075E54] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={validation.errors.length > 0}
                onClick={publishFlow}
                type="button"
              >
                <Rocket className="mr-1.5 h-3.5 w-3.5" />
                Publish
              </button>
            </div>
          </div>

          <div className="h-[720px]">
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
              nodeTypes={nodeTypes}
              nodes={nodesWithValidation}
              onInit={setFlowInstance}
              onConnect={onConnect}
              onEdgesChange={onEdgesChange}
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
            </ReactFlow>
          </div>
        </div>

        <NodeEditingDrawer
          isOpen={isDrawerOpen}
          node={selectedNode}
          nodes={nodes}
          onClose={() => setIsDrawerOpen(false)}
          onDelete={deleteNode}
          onDuplicate={duplicateNode}
          onSave={saveNode}
        />
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
            {[...validation.errors, ...validation.warnings].map((issue) => (
              <button
                className={[
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition",
                  issue.severity === "ERROR"
                    ? "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100"
                    : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
                ].join(" ")}
                key={`${issue.severity}-${issue.code}-${issue.nodeId ?? issue.edgeId ?? "graph"}`}
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
    </ReactFlowProvider>
  );
}
