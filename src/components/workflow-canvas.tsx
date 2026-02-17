"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import type { ProjectStage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Play, CheckCircle2, Clock, Loader2, Trash2, Plus,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WorkflowCanvasProps {
  stages: ProjectStage[];
  readOnly?: boolean;
  isAdmin?: boolean;
  isWorker?: boolean;
  onUpdateStatus?: (stageId: string, status: ProjectStage["status"]) => void;
  onRemoveStage?: (stageId: string) => void;
  onAddStage?: (name: string) => void;
}

type StageNodeData = {
  label: string;
  status: ProjectStage["status"];
  isSourceOnly?: boolean;
  readOnly: boolean;
  isAdmin: boolean;
  isWorker: boolean;
  onStart: () => void;
  onComplete: () => void;
  onDelete: () => void;
};

/* ------------------------------------------------------------------ */
/*  Custom StageNode                                                   */
/* ------------------------------------------------------------------ */

function StageNode({ data }: { data: StageNodeData }) {
  const statusIcon =
    data.status === "completed" ? (
      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
    ) : data.status === "in_progress" ? (
      <Loader2 className="h-5 w-5 text-blue-500 animate-spin shrink-0" />
    ) : (
      <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
    );

  const statusColor =
    data.status === "completed"
      ? "border-green-500/50 bg-green-50 dark:bg-green-950/30"
      : data.status === "in_progress"
        ? "border-blue-500/50 bg-blue-50 dark:bg-blue-950/30"
        : "border-border bg-card";

  return (
    <div
      className={`rounded-lg border-2 shadow-sm px-4 py-3 min-w-[180px] max-w-[220px] ${statusColor}`}
    >
      {!data.isSourceOnly && <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2" />}
      <div className="flex items-center gap-2 mb-1">
        {statusIcon}
        <span className="font-medium text-sm truncate text-foreground">{data.label}</span>
      </div>
      <p className="text-xs text-muted-foreground capitalize mb-2">
        {data.status.replace("_", " ")}
      </p>
      {!data.readOnly && (
        <div className="flex items-center gap-1 flex-wrap">
          {(data.isAdmin || data.isWorker) && data.status === "pending" && (
            <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={data.onStart}>
              <Play className="h-3 w-3 mr-1" /> Start
            </Button>
          )}
          {(data.isAdmin || data.isWorker) && data.status === "in_progress" && (
            <Button
              size="sm"
              className="h-6 text-xs px-2 bg-green-600 hover:bg-green-700 text-white"
              onClick={data.onComplete}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" /> Done
            </Button>
          )}
          {data.isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-xs px-1 text-destructive"
              onClick={data.onDelete}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dagre layout                                                       */
/* ------------------------------------------------------------------ */

function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB",
) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 50, ranksep: 80 });

  nodes.forEach((n) => g.setNode(n.id, { width: 200, height: 100 }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  const laid = nodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: { x: pos.x - 100, y: pos.y - 50 } };
  });
  return { nodes: laid, edges };
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const nodeTypes: NodeTypes = { stage: StageNode as any };

export function WorkflowCanvas({
  stages,
  readOnly = false,
  isAdmin = false,
  isWorker = false,
  onUpdateStatus,
  onRemoveStage,
  onAddStage,
}: WorkflowCanvasProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [newStageName, setNewStageName] = useState("");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const sorted = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages],
  );

  const direction = isMobile ? "TB" : "LR";

  const rawNodes: Node[] = sorted.map((s) => ({
    id: s.id,
    type: "stage",
    position: { x: 0, y: 0 },
    draggable: !readOnly,
    data: {
      label: s.name,
      status: s.status,
      isSourceOnly: s.position === 0,
      readOnly,
      isAdmin,
      isWorker,
      onStart: () => onUpdateStatus?.(s.id, "in_progress"),
      onComplete: () => onUpdateStatus?.(s.id, "completed"),
      onDelete: () => onRemoveStage?.(s.id),
    } satisfies StageNodeData,
  }));

  const rawEdges: Edge[] = sorted.slice(1).map((s, i) => ({
    id: `e-${sorted[i].id}-${s.id}`,
    source: sorted[i].id,
    target: s.id,
    animated: sorted[i].status === "in_progress",
    style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
  }));

  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
    rawNodes,
    rawEdges,
    direction,
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Re-layout when stages change
  useEffect(() => {
    const { nodes: ln, edges: le } = getLayoutedElements(rawNodes, rawEdges, direction);
    setNodes(ln);
    setEdges(le);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages.map((s) => `${s.id}:${s.status}`).join(","), direction]);

  return (
    <div className="relative w-full" style={{ height: isMobile ? 400 : 500 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={!readOnly}
        nodesConnectable={false}
        elementsSelectable={!readOnly}
        className="rounded-lg border bg-background"
      >
        <Controls showInteractive={false} />
        {!isMobile && <MiniMap zoomable pannable className="!bg-muted" />}
        <Background gap={16} size={1} />
      </ReactFlow>

      {/* Floating add stage button */}
      {!readOnly && (isAdmin || isWorker) && onAddStage && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-4 sm:right-auto flex gap-2 z-10">
          <Input
            placeholder="New stage name..."
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newStageName.trim()) {
                onAddStage(newStageName.trim());
                setNewStageName("");
              }
            }}
            className="w-48 sm:w-56 bg-background shadow-md"
          />
          <Button
            size="sm"
            disabled={!newStageName.trim()}
            onClick={() => {
              if (newStageName.trim()) {
                onAddStage(newStageName.trim());
                setNewStageName("");
              }
            }}
            className="shadow-md"
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
      )}
    </div>
  );
}
