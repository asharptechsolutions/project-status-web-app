"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Controls,
  Background,
  Panel,
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
import {
  Play, CheckCircle2, Clock, Loader2, Trash2, AlignHorizontalDistributeCenter,
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
}

type StageNodeData = {
  label: string;
  status: ProjectStage["status"];
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
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2" />
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
/*  Starter node (source-only, no target handle)                       */
/* ------------------------------------------------------------------ */

function StarterNode({ data }: { data: StageNodeData }) {
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

const nodeTypes: NodeTypes = { stage: StageNode as any, starter: StarterNode as any };

export function WorkflowCanvas({
  stages,
  readOnly = false,
  isAdmin = false,
  isWorker = false,
  onUpdateStatus,
  onRemoveStage,
}: WorkflowCanvasProps) {
  const [isMobile, setIsMobile] = useState(false);

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

  const isInitialMount = useRef(true);
  const prevDirection = useRef(direction);
  const prevStageIds = useRef<string[]>([]);

  const rawNodes: Node[] = sorted.map((s, i) => ({
    id: s.id,
    type: i === 0 ? "starter" : "stage",
    position: { x: 0, y: 0 },
    draggable: !readOnly,
    data: {
      label: s.name,
      status: s.status,
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

  // Sync nodes/edges when stages change, preserving user-dragged positions
  useEffect(() => {
    const currentIds = sorted.map((s) => s.id);
    const directionChanged = prevDirection.current !== direction;
    prevDirection.current = direction;

    // Initial mount or direction change → full Dagre layout
    if (isInitialMount.current || directionChanged) {
      isInitialMount.current = false;
      prevStageIds.current = currentIds;
      const { nodes: ln, edges: le } = getLayoutedElements(rawNodes, rawEdges, direction);
      setNodes(ln);
      setEdges(le);
      return;
    }

    const prevIds = prevStageIds.current;
    const addedIds = currentIds.filter((id) => !prevIds.includes(id));
    prevStageIds.current = currentIds;

    // Build position map from current nodes state (includes user-dragged positions)
    const positionMap = new Map<string, { x: number; y: number }>();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    nodes.forEach((n) => positionMap.set(n.id, n.position));

    // Update nodes: preserve existing positions, calculate new positions for added nodes
    const updatedNodes: Node[] = rawNodes.map((rn) => {
      const existingPos = positionMap.get(rn.id);
      if (existingPos && !addedIds.includes(rn.id)) {
        return { ...rn, position: existingPos };
      }
      return rn;
    });

    // Place newly added nodes after the last existing node
    if (addedIds.length > 0) {
      const existingNodes = updatedNodes.filter((n) => !addedIds.includes(n.id));
      let lastPos = { x: 0, y: 0 };
      if (existingNodes.length > 0) {
        lastPos = existingNodes[existingNodes.length - 1].position;
      }
      addedIds.forEach((id, i) => {
        const nodeIdx = updatedNodes.findIndex((n) => n.id === id);
        if (nodeIdx !== -1) {
          updatedNodes[nodeIdx] = {
            ...updatedNodes[nodeIdx],
            position: direction === "LR"
              ? { x: lastPos.x + 280 * (i + 1), y: lastPos.y }
              : { x: lastPos.x, y: lastPos.y + 180 * (i + 1) },
          };
        }
      });
    }

    setNodes(updatedNodes);
    setEdges(rawEdges);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages.map((s) => `${s.id}:${s.status}`).join(","), direction]);

  const handleAutoAlign = useCallback(() => {
    prevStageIds.current = sorted.map((s) => s.id);
    const { nodes: ln, edges: le } = getLayoutedElements(rawNodes, rawEdges, direction);
    setNodes(ln);
    setEdges(le);
  }, [sorted, rawNodes, rawEdges, direction, setNodes, setEdges]);

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
        <Background gap={16} size={1} />
        {!readOnly && (
          <Panel position="top-right">
            <Button
              size="sm"
              variant="outline"
              className="bg-background shadow-sm"
              onClick={handleAutoAlign}
              title="Auto-align nodes"
            >
              <AlignHorizontalDistributeCenter className="h-4 w-4 mr-1" />
              Auto Align
            </Button>
          </Panel>
        )}
      </ReactFlow>

    </div>
  );
}
