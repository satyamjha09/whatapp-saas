"use client";

import { useMemo } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  type Edge,
} from "@xyflow/react";
import NodeRenderer, {
  type AutomationFlowNode,
} from "./node-renderer";
import type { AutomationGraph, AutomationNode } from "./types";
import { getAutomationNodeLabel } from "./types";

type AutomationGraphPreviewProps = {
  graph: AutomationGraph;
};

const nodeTypes = {
  automationNode: NodeRenderer,
};

function toFlowNode(node: AutomationNode): AutomationFlowNode {
  return {
    id: node.id,
    type: "automationNode",
    position: node.position,
    data: {
      ...node.data,
      label: node.data.label || getAutomationNodeLabel(node.type),
      nodeType: node.type,
    },
  };
}

function toFlowEdge(edge: AutomationGraph["edges"][number]): Edge {
  return {
    id: edge.id,
    label: edge.label,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "#128C7E",
    },
    style: {
      stroke: "#128C7E",
      strokeWidth: 2,
    },
  };
}

function FlowCanvas({ graph }: AutomationGraphPreviewProps) {
  const nodes = useMemo(() => graph.nodes.map(toFlowNode), [graph.nodes]);
  const edges = useMemo(() => graph.edges.map(toFlowEdge), [graph.edges]);

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border border-[#D8E6F3] bg-white">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={true}
        zoomOnScroll={true}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#CBD5E1" />
        <Controls showInteractive={false} className="shadow-sm" />
      </ReactFlow>
    </div>
  );
}

export default function AutomationGraphPreview({ graph }: AutomationGraphPreviewProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvas graph={graph} />
    </ReactFlowProvider>
  );
}
