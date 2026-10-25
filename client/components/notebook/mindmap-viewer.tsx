"use client";
import { useMemo, useRef } from "react";
import { useTheme } from "next-themes";
import dagre from "@dagrejs/dagre";
import {
  Background, Controls, MiniMap, Position, ReactFlow,
  useNodesState, type Edge, type Node, type ReactFlowInstance,
} from "@xyflow/react";

type MindmapNode = { id: string; label: string };
type MindmapEdge = { id: string; source: string; target: string };

function layoutMindmap(inputNodes: MindmapNode[], inputEdges: MindmapEdge[]) {
  const uniqueNodes = [...new Map(inputNodes.map((node) => [node.id, node])).values()];
  const ids = new Set(uniqueNodes.map((node) => node.id));
  const edges: Edge[] = inputEdges
    .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    .map((edge) => ({ ...edge, type: "smoothstep", selectable: false }));
  const targets = new Set(edges.map((edge) => edge.target));
  const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "LR", nodesep: 32, ranksep: 80, marginx: 24, marginy: 24 });
  const sizes = new Map(uniqueNodes.map((node) => [node.id, { width: 240, height: Math.max(76, Math.ceil(node.label.length / 25) * 18 + 32) }]));
  uniqueNodes.forEach((node) => graph.setNode(node.id, { ...sizes.get(node.id)! }));
  edges.forEach((edge) => graph.setEdge(edge.source, edge.target));
  dagre.layout(graph);
  const nodes: Node[] = uniqueNodes.map((node, index) => {
    const size = sizes.get(node.id)!;
    const position = graph.node(node.id);
    return {
      id: node.id,
      data: { label: node.label },
      position: { x: position.x - size.width / 2, y: position.y - size.height / 2 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      className: !targets.has(node.id) ? "mindmap-root" : `mindmap-branch branch-${index % 3}`,
      style: size,
    };
  });
  return { nodes, edges };
}

export function MindmapViewer({ nodes: inputNodes, edges: inputEdges }: { nodes: MindmapNode[]; edges: MindmapEdge[] }) {
  const { resolvedTheme } = useTheme();
  const layout = useMemo(() => layoutMindmap(inputNodes, inputEdges), [inputNodes, inputEdges]);
  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const flow = useRef<ReactFlowInstance | null>(null);
  if (!inputNodes.length) return <p className="muted">There are no concepts to display in this mind map.</p>;
  return (
    <>
      <div className="mindmap-toolbar">
        <p>Drag concepts to rearrange. Pan or zoom to explore.</p>
        <button className="button small" onClick={() => {
          setNodes(layout.nodes);
          requestAnimationFrame(() => { void flow.current?.fitView({ padding: 0.2 }); });
        }}>Reset layout</button>
      </div>
      <div className="mindmap-flow" aria-label="Interactive mind map">
        <ReactFlow
          nodes={nodes}
          edges={layout.edges}
          onNodesChange={onNodesChange}
          onInit={(instance) => {
            flow.current = instance;
            // The dialog opens after its children mount; fit once it is visible.
            requestAnimationFrame(() => { void instance.fitView({ padding: 0.2 }); });
          }}
          colorMode={resolvedTheme === "dark" ? "dark" : "light"}
          nodesConnectable={false}
          edgesReconnectable={false}
          deleteKeyCode={null}
          minZoom={0.1}
          maxZoom={2.5}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background color="var(--grid)" gap={20} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable style={{ width: 130, height: 90 }} nodeColor={(node) => node.className === "mindmap-root" ? "var(--yellow)" : "var(--purple)"} />
        </ReactFlow>
      </div>
    </>
  );
}
