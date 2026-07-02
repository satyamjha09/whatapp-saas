"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Panel as ReactFlowPanel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnNodeDrag,
} from "@xyflow/react";
import {
  Bot,
  CircleDot,
  GitBranch,
  MessageSquareText,
  Play,
  RadioTower,
  Save,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createChatbotCanvasEdgeAction,
  deleteChatbotCanvasEdgeAction,
  updateChatbotNodePositionAction,
} from "../../actions";

export type ChatbotCanvasNode = {
  configSummary: string;
  id: string;
  name: string;
  nodeKey: string;
  positionX: number;
  positionY: number;
  type: string;
};

export type ChatbotCanvasEdge = {
  id: string;
  label: string | null;
  sourceNodeId: string;
  targetNodeId: string;
};

type ChatbotNodeData = Record<string, unknown> & {
  configSummary: string;
  label: string;
  nodeKey: string;
  nodeType: string;
};
type ChatbotFlowNodeType = Node<ChatbotNodeData, "chatbotNode">;

const nodeTone: Record<string, string> = {
  API_CALL: "border-blue-200 bg-blue-50 text-blue-700",
  ASSIGN_AGENT: "border-amber-200 bg-amber-50 text-amber-700",
  AI_REPLY: "border-violet-200 bg-violet-50 text-violet-700",
  CATALOG_PRODUCT_CARD: "border-teal-200 bg-teal-50 text-teal-700",
  CONDITION: "border-purple-200 bg-purple-50 text-purple-700",
  END: "border-rose-200 bg-rose-50 text-rose-700",
  GOOGLE_SHEET_SAVE: "border-green-200 bg-green-50 text-green-700",
  LIST_MENU: "border-cyan-200 bg-cyan-50 text-cyan-700",
  MEDIA_BUTTONS: "border-lime-200 bg-lime-50 text-lime-700",
  MESSAGE: "border-[#BFE9D0] bg-[#E7F8EF] text-[#128C7E]",
  PAYMENT_LINK: "border-emerald-200 bg-emerald-50 text-emerald-700",
  QUESTION: "border-orange-200 bg-orange-50 text-orange-700",
  QUICK_REPLY: "border-emerald-200 bg-emerald-50 text-emerald-700",
  START: "border-[#BFE9D0] bg-[#E7F8EF] text-[#128C7E]",
  TALLY_INVOICE_LOOKUP: "border-sky-200 bg-sky-50 text-sky-700",
  TALLY_LEDGER_BALANCE: "border-sky-200 bg-sky-50 text-sky-700",
  WEBHOOK: "border-indigo-200 bg-indigo-50 text-indigo-700",
};

function formatType(value: string) {
  return value.replaceAll("_", " ");
}

function NodeIcon({ type }: { type: string }) {
  if (type === "START") return <Play className="h-5 w-5" />;
  if (type === "END") return <CircleDot className="h-5 w-5" />;
  if (type === "CONDITION") return <GitBranch className="h-5 w-5" />;
  if (type === "MESSAGE" || type === "QUESTION") {
    return <MessageSquareText className="h-5 w-5" />;
  }
  if (type === "API_CALL" || type === "WEBHOOK") {
    return <RadioTower className="h-5 w-5" />;
  }
  return <Bot className="h-5 w-5" />;
}

function ChatbotFlowNode({
  data,
  selected,
}: NodeProps<ChatbotFlowNodeType>) {
  const tone =
    nodeTone[data.nodeType] ?? "border-zinc-200 bg-zinc-50 text-zinc-700";

  return (
    <div
      className={[
        "w-[250px] rounded-xl border bg-white shadow-[0_14px_34px_rgba(8,27,58,0.10)] transition",
        selected ? "ring-4 ring-[#128C7E]/15" : "",
      ].join(" ")}
    >
      {data.nodeType !== "START" ? (
        <Handle
          className="!h-3 !w-3 !border-2 !border-white !bg-[#128C7E]"
          position={Position.Left}
          type="target"
        />
      ) : null}
      <div className="flex items-start gap-3 border-b border-[#E7F8EF] p-3">
        <span
          className={[
            "grid h-10 w-10 shrink-0 place-items-center rounded-lg border",
            tone,
          ].join(" ")}
        >
          <NodeIcon type={data.nodeType} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[#081B3A]">
            {data.label}
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-normal text-[#128C7E]">
            {formatType(data.nodeType)}
          </p>
        </div>
      </div>
      <div className="p-3">
        <p className="line-clamp-3 text-xs leading-5 text-[#526173]">
          {data.configSummary}
        </p>
        <p className="mt-3 truncate text-[11px] text-[#526173]/75">
          {data.nodeKey}
        </p>
      </div>
      {data.nodeType !== "END" ? (
        <Handle
          className="!h-3 !w-3 !border-2 !border-white !bg-[#128C7E]"
          position={Position.Right}
          type="source"
        />
      ) : null}
    </div>
  );
}

const nodeTypes = {
  chatbotNode: ChatbotFlowNode,
};

function toFlowNode(node: ChatbotCanvasNode): ChatbotFlowNodeType {
  return {
    data: {
      configSummary: node.configSummary,
      label: node.name,
      nodeKey: node.nodeKey,
      nodeType: node.type,
    },
    id: node.id,
    position: {
      x: node.positionX,
      y: node.positionY,
    },
    deletable: false,
    type: "chatbotNode",
  };
}

function toFlowEdge(edge: ChatbotCanvasEdge): Edge {
  return {
    animated: false,
    id: edge.id,
    label: edge.label ?? undefined,
    markerEnd: {
      color: "#128C7E",
      type: MarkerType.ArrowClosed,
    },
    deletable: true,
    source: edge.sourceNodeId,
    style: {
      stroke: "#128C7E",
      strokeWidth: 2,
    },
    target: edge.targetNodeId,
  };
}

export default function ChatbotFlowCanvas({
  chatbotId,
  edges: initialEdges,
  nodes: initialNodes,
}: {
  chatbotId: string;
  edges: ChatbotCanvasEdge[];
  nodes: ChatbotCanvasNode[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState("Canvas ready");
  const initialFlowNodes = useMemo(
    () => initialNodes.map(toFlowNode),
    [initialNodes],
  );
  const initialFlowEdges = useMemo(
    () => initialEdges.map(toFlowEdge),
    [initialEdges],
  );
  const [nodes, setNodes, onNodesChange] =
    useNodesState<ChatbotFlowNodeType>(initialFlowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlowEdges);
  const connectionLineStyle = useMemo(
    () => ({
      stroke: "#128C7E",
      strokeWidth: 2,
    }),
    [],
  );

  useEffect(() => {
    setNodes(initialFlowNodes);
    setEdges(initialFlowEdges);
  }, [initialFlowEdges, initialFlowNodes, setEdges, setNodes]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) {
        setStatus("Connect two different nodes");
        return;
      }
      if (
        edges.some(
          (edge) =>
            edge.source === connection.source && edge.target === connection.target,
        )
      ) {
        setStatus("Connection already exists");
        return;
      }

      const optimisticEdge: Edge = {
        ...connection,
        id: `draft-${connection.source}-${connection.target}-${Date.now()}`,
        markerEnd: {
          color: "#128C7E",
          type: MarkerType.ArrowClosed,
        },
        style: {
          stroke: "#128C7E",
          strokeWidth: 2,
        },
      };

      setEdges((currentEdges) => addEdge(optimisticEdge, currentEdges));
      setStatus("Saving connection...");
      startTransition(async () => {
        const result = await createChatbotCanvasEdgeAction({
          chatbotId,
          sourceNodeId: connection.source!,
          targetNodeId: connection.target!,
        });

        if (!result.ok) {
          setEdges((currentEdges) =>
            currentEdges.filter((edge) => edge.id !== optimisticEdge.id),
          );
        }
        setStatus(
          result.message ??
            (result.ok ? "Connection saved" : "Unable to save connection"),
        );
        router.refresh();
      });
    },
    [chatbotId, edges, router, setEdges],
  );

  const onNodeDragStop: OnNodeDrag<ChatbotFlowNodeType> = useCallback(
    (_event, node) => {
      setStatus("Saving position...");
      startTransition(async () => {
        const result = await updateChatbotNodePositionAction({
          chatbotId,
          nodeId: node.id,
          positionX: node.position.x,
          positionY: node.position.y,
        });

        setStatus(result.message ?? (result.ok ? "Position saved" : "Done"));
      });
    },
    [chatbotId],
  );

  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      const savedEdges = deletedEdges.filter(
        (edge) => !edge.id.startsWith("draft-"),
      );

      if (savedEdges.length === 0) return;

      setStatus("Removing connection...");
      startTransition(async () => {
        const results = await Promise.all(
          savedEdges.map((edge) =>
            deleteChatbotCanvasEdgeAction({
              chatbotId,
              edgeId: edge.id,
            }),
          ),
        );
        const failed = results.find((result) => !result.ok);

        setStatus(
          failed?.message ??
            `${savedEdges.length.toLocaleString("en-IN")} connection removed`,
        );
        router.refresh();
      });
    },
    [chatbotId, router],
  );

  return (
    <ReactFlowProvider>
      <div className="relative h-[680px] overflow-hidden rounded-2xl border border-[#BFE9D0] bg-[#F7FBFF]">
        <ReactFlow
          colorMode="light"
          connectionLineStyle={connectionLineStyle}
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
          edges={edges}
          fitView
          fitViewOptions={{
            maxZoom: 1,
            padding: 0.24,
          }}
          minZoom={0.35}
          nodeTypes={nodeTypes}
          nodes={nodes}
          deleteKeyCode={["Backspace", "Delete"]}
          onConnect={onConnect}
          onEdgesChange={onEdgesChange}
          onEdgesDelete={onEdgesDelete}
          onNodeDragStop={onNodeDragStop}
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
              {isPending ? "Saving..." : status}
            </div>
          </ReactFlowPanel>
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}
