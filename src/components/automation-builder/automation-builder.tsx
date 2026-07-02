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
} from "@xyflow/react";
import { Save, Workflow } from "lucide-react";
import NodeEditingDrawer from "@/components/automation-builder/node-editing-drawer";
import NodePalette from "@/components/automation-builder/node-palette";
import NodeRenderer, {
  type AutomationFlowNode,
} from "@/components/automation-builder/node-renderer";
import {
  createDefaultAutomationGraph,
  formatNodeType,
  getDefaultNodeData,
  type AutomationGraph,
  type AutomationGraphNode,
  type AutomationNodeData,
  type AutomationNodeType,
} from "@/components/automation-builder/types";

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

function toFlowNode(node: AutomationGraphNode): AutomationFlowNode {
  return {
    data: {
      ...node.data,
      label: node.data.label || formatNodeType(node.type),
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
    style: {
      stroke: "#128C7E",
      strokeWidth: 2,
    },
    target: edge.target,
  };
}

function calculateNewPosition(count: number) {
  return {
    x: 140 + (count % 4) * 300,
    y: 120 + Math.floor(count / 4) * 170,
  };
}

export default function AutomationBuilder({
  flowId,
  initialGraph,
}: AutomationBuilderProps) {
  const graph = useMemo(
    () => initialGraph ?? createDefaultAutomationGraph(flowId),
    [flowId, initialGraph],
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
  const [status, setStatus] = useState("Graph ready");

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const graphSnapshot = useMemo(
    () => ({
      edges: edges.map((edge) => ({
        id: edge.id,
        label: typeof edge.label === "string" ? edge.label : undefined,
        source: edge.source,
        target: edge.target,
      })),
      id: flowId,
      nodes: nodes.map((node) => ({
        data: node.data,
        id: node.id,
        position: {
          x: Math.round(node.position.x),
          y: Math.round(node.position.y),
        },
        type: node.data.nodeType,
      })),
    }),
    [edges, flowId, nodes],
  );

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

      if (connection.source === connection.target) {
        setStatus("Connect two different nodes");
        return;
      }

      const alreadyExists = edges.some(
        (edge) =>
          edge.source === connection.source && edge.target === connection.target,
      );

      if (alreadyExists) {
        setStatus("Connection already exists");
        return;
      }

      const edge: Edge = {
        ...connection,
        id: createId("edge"),
        markerEnd: {
          color: "#128C7E",
          type: MarkerType.ArrowClosed,
        },
        style: {
          stroke: "#128C7E",
          strokeWidth: 2,
        },
      };

      setEdges((currentEdges) => addEdge(edge, currentEdges));
      setStatus("Connection added");
    },
    [edges, setEdges],
  );

  function addNode(type: AutomationNodeType) {
    const id = createId(`node_${type.toLowerCase()}`);
    const data = getDefaultNodeData(type);
    const node: AutomationFlowNode = {
      data: {
        ...data,
        label: data.label || formatNodeType(type),
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
    setStatus(`${formatNodeType(type)} added`);
  }

  function saveNode(nodeId: string, data: AutomationNodeData) {
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
                  {edges.length.toLocaleString("en-IN")} connections
                </p>
              </div>
            </div>
            <span className="rounded-full bg-[#E7F8EF] px-3 py-1 text-xs font-semibold text-[#128C7E]">
              {status}
            </span>
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
              edges={edges}
              fitView
              fitViewOptions={{
                maxZoom: 1,
                padding: 0.24,
              }}
              minZoom={0.35}
              nodeTypes={nodeTypes}
              nodes={nodes}
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
                  Graph JSON ready
                </div>
              </ReactFlowPanel>
            </ReactFlow>
          </div>
        </div>

        <NodeEditingDrawer
          isOpen={isDrawerOpen}
          node={selectedNode}
          onClose={() => setIsDrawerOpen(false)}
          onDelete={deleteNode}
          onDuplicate={duplicateNode}
          onSave={saveNode}
        />
      </section>

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
        <pre className="mt-4 max-h-72 overflow-auto rounded-xl bg-[#081B3A] p-4 text-xs leading-5 text-[#DFF8EB]">
          {JSON.stringify(graphSnapshot, null, 2)}
        </pre>
      </div>
    </ReactFlowProvider>
  );
}
