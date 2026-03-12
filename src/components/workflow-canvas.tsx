"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  Controls,
  Background,
  Panel,
  MarkerType,
  addEdge,
  useNodesState,
  useEdgesState,
  useInternalNode,
  EdgeLabelRenderer,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
  type EdgeProps,
  type InternalNode,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import ELK from "elkjs/lib/elk.bundled.js";
import type { ProjectStage, ClientVisibilitySettings, StageDependency } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Play, CheckCircle2, Clock, Loader2, AlignHorizontalDistributeCenter,
  User, UserPlus, X, Plus, Pencil, Calendar, Lock, Unlock,
} from "lucide-react";

const elk = new ELK();

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
  onAssignWorker?: (stageId: string) => void;
  onAddStage?: () => void;
  onEditStage?: (stageId: string) => void;
  workerNames?: Record<string, string>;
  progress?: number;
  locked?: boolean;
  onLockedChange?: (locked: boolean, positions?: Record<string, { x: number; y: number }>) => void;
  savedPositions?: Record<string, { x: number; y: number }> | null;
  onPositionsChange?: (positions: Record<string, { x: number; y: number }>) => void;
  visibilitySettings?: ClientVisibilitySettings | null;
  dependencies?: StageDependency[];
  onAddDependency?: (sourceId: string, targetId: string) => void;
  onRemoveDependency?: (dependencyId: string) => void;
  timeByStage?: Record<string, number>;
}

type StageNodeData = {
  label: string;
  status: ProjectStage["status"];
  readOnly: boolean;
  isAdmin: boolean;
  isWorker: boolean;
  assignedWorkerName: string | null;
  estimatedCompletion: string | null;
  onStart: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onAssignWorker: () => void;
  onEdit: () => void;
  hideWorkerName?: boolean;
  hideEstimatedCompletion?: boolean;
  hideStatusText?: boolean;
  totalMinutes: number;
};

/* ------------------------------------------------------------------ */
/*  Floating edge utilities                                            */
/* ------------------------------------------------------------------ */

function getNodeIntersection(intersectionNode: InternalNode, targetNode: InternalNode) {
  const w = (intersectionNode.measured.width ?? 0) / 2;
  const h = (intersectionNode.measured.height ?? 0) / 2;

  const x2 = intersectionNode.internals.positionAbsolute.x + w;
  const y2 = intersectionNode.internals.positionAbsolute.y + h;
  const x1 = targetNode.internals.positionAbsolute.x + (targetNode.measured.width ?? 0) / 2;
  const y1 = targetNode.internals.positionAbsolute.y + (targetNode.measured.height ?? 0) / 2;

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  const x = w * (xx3 + yy3) + x2;
  const y = h * (-xx3 + yy3) + y2;

  return { x, y };
}

function getEdgePosition(node: InternalNode, intersectionPoint: { x: number; y: number }) {
  const nx = Math.round(node.internals.positionAbsolute.x);
  const ny = Math.round(node.internals.positionAbsolute.y);
  const px = Math.round(intersectionPoint.x);
  const py = Math.round(intersectionPoint.y);

  if (px <= nx + 1) return Position.Left;
  if (px >= nx + (node.measured.width ?? 0) - 1) return Position.Right;
  if (py <= ny + 1) return Position.Top;
  if (py >= ny + (node.measured.height ?? 0) - 1) return Position.Bottom;
  return Position.Top;
}

function getEdgeParams(source: InternalNode, target: InternalNode) {
  const sourceIntersection = getNodeIntersection(source, target);
  const targetIntersection = getNodeIntersection(target, source);
  const sourcePos = getEdgePosition(source, sourceIntersection);
  const targetPos = getEdgePosition(target, targetIntersection);

  return {
    sx: sourceIntersection.x,
    sy: sourceIntersection.y,
    tx: targetIntersection.x,
    ty: targetIntersection.y,
    sourcePos,
    targetPos,
  };
}

/* ------------------------------------------------------------------ */
/*  Floating edge component                                            */
/* ------------------------------------------------------------------ */

// Shared ref so FloatingEdge can call back to delete itself
const deleteEdgeRef: { current: ((edgeId: string) => void) | null } = { current: null };

function FloatingEdge({ id, source, target, markerEnd, style, animated }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  const [hovered, setHovered] = useState(false);

  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty } = getEdgeParams(sourceNode, targetNode);

  // Straight line path
  const edgePath = `M ${sx},${sy}L ${tx},${ty}`;

  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2;

  const canDelete = !!deleteEdgeRef.current;

  return (
    <>
      <path
        id={id}
        className={`react-flow__edge-path ${animated ? "react-flow__edge-path--animated" : ""}`}
        d={edgePath}
        markerEnd={markerEnd as string}
        style={style}
      />
      {/* Invisible wider path for easier hover targeting */}
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        className="react-flow__edge-interaction"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {canDelete && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute"
            style={{
              transform: `translate(-50%, -50%) translate(${midX}px,${midY}px)`,
              opacity: hovered ? 1 : 0,
              transition: "opacity 150ms",
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <button
              type="button"
              onClick={() => deleteEdgeRef.current?.(id)}
              className="h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:scale-110"
              title="Delete edge"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared node content                                                */
/* ------------------------------------------------------------------ */

function NodeContent({ data, showTarget }: { data: StageNodeData; showTarget: boolean }) {
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
    <div className={`group relative rounded-lg border-2 shadow-sm px-4 py-3 min-w-[180px] max-w-[220px] ${statusColor}`}>
      {/* Hover action buttons */}
      {data.isAdmin && !data.readOnly && (
        <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); data.onEdit(); }}
            className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:scale-110"
            title="Edit stage"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); data.onDelete(); }}
            className="h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:scale-110"
            title="Delete stage"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {/* Handles on all 4 sides — visible on hover so users can drag new edges */}
      {showTarget && (
        <>
          <Handle type="target" position={Position.Top} id="target-top" className="!bg-primary !w-2 !h-2 !opacity-0 group-hover:!opacity-100 !transition-opacity" />
          <Handle type="target" position={Position.Right} id="target-right" className="!bg-primary !w-2 !h-2 !opacity-0 group-hover:!opacity-100 !transition-opacity" />
          <Handle type="target" position={Position.Bottom} id="target-bottom" className="!bg-primary !w-2 !h-2 !opacity-0 group-hover:!opacity-100 !transition-opacity" />
          <Handle type="target" position={Position.Left} id="target-left" className="!bg-primary !w-2 !h-2 !opacity-0 group-hover:!opacity-100 !transition-opacity" />
        </>
      )}
      <Handle type="source" position={Position.Top} id="source-top" className="!bg-primary !w-2 !h-2 !opacity-0 group-hover:!opacity-100 !transition-opacity" />
      <Handle type="source" position={Position.Right} id="source-right" className="!bg-primary !w-2 !h-2 !opacity-0 group-hover:!opacity-100 !transition-opacity" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="!bg-primary !w-2 !h-2 !opacity-0 group-hover:!opacity-100 !transition-opacity" />
      <Handle type="source" position={Position.Left} id="source-left" className="!bg-primary !w-2 !h-2 !opacity-0 group-hover:!opacity-100 !transition-opacity" />

      <div className="flex items-center gap-2 mb-1">
        {statusIcon}
        <span className="font-medium text-sm truncate text-foreground">{data.label}</span>
      </div>
      {!data.hideStatusText && (
        <p className="text-xs text-muted-foreground capitalize mb-1">
          {data.status.replace("_", " ")}
        </p>
      )}
      {/* Worker assignment */}
      {!data.hideWorkerName && (
        data.assignedWorkerName ? (
          <button
            type="button"
            onClick={data.isAdmin && !data.readOnly ? data.onAssignWorker : undefined}
            className={`flex items-center gap-1 text-xs text-muted-foreground mb-2 max-w-full ${data.isAdmin && !data.readOnly ? "hover:text-foreground cursor-pointer" : ""}`}
          >
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{data.assignedWorkerName}</span>
          </button>
        ) : data.isAdmin && !data.readOnly ? (
          <button
            type="button"
            onClick={data.onAssignWorker}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2 cursor-pointer"
          >
            <UserPlus className="h-3 w-3 shrink-0" />
            <span>Assign</span>
          </button>
        ) : null
      )}
      {/* Estimated completion */}
      {!data.hideEstimatedCompletion && data.estimatedCompletion && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>{new Date(data.estimatedCompletion + "T00:00:00").toLocaleDateString()}</span>
        </div>
      )}
      {/* Time tracking badge */}
      {data.totalMinutes > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{data.totalMinutes < 60 ? `${data.totalMinutes}m` : `${Math.floor(data.totalMinutes / 60)}h ${data.totalMinutes % 60 > 0 ? `${data.totalMinutes % 60}m` : ""}`}</span>
        </div>
      )}
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
              className="h-6 text-xs px-2 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={data.onComplete}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Complete
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Custom nodes                                                       */
/* ------------------------------------------------------------------ */

function StageNode({ data }: { data: StageNodeData }) {
  return <NodeContent data={data} showTarget />;
}

function StarterNode({ data }: { data: StageNodeData }) {
  return <NodeContent data={data} showTarget={false} />;
}

/* ------------------------------------------------------------------ */
/*  ELK layout                                                         */
/* ------------------------------------------------------------------ */

const NODE_WIDTH = 200;
const NODE_HEIGHT = 140;

async function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB",
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const elkDirection = direction === "LR" ? "RIGHT" : "DOWN";

  const graph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": elkDirection,
      "elk.edgeRouting": "ORTHOGONAL",
      "elk.layered.spacing.nodeNodeBetweenLayers": "100",
      "elk.spacing.nodeNode": "80",
      "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const layoutedGraph = await elk.layout(graph);

  const layoutedNodes = nodes.map((node) => {
    const elkNode = layoutedGraph.children?.find((n) => n.id === node.id);
    return {
      ...node,
      position: { x: elkNode?.x ?? 0, y: elkNode?.y ?? 0 },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const nodeTypes: NodeTypes = { stage: StageNode as any, starter: StarterNode as any };
const edgeTypes: EdgeTypes = { floating: FloatingEdge as any };

function WorkflowCanvasInner({
  stages,
  readOnly = false,
  isAdmin = false,
  isWorker = false,
  onUpdateStatus,
  onRemoveStage,
  onAssignWorker,
  onAddStage,
  onEditStage,
  workerNames,
  progress,
  locked: lockedProp = false,
  onLockedChange,
  savedPositions,
  onPositionsChange,
  visibilitySettings,
  dependencies,
  onAddDependency,
  onRemoveDependency,
  timeByStage,
}: WorkflowCanvasProps) {
  const { fitView } = useReactFlow();
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
  const locked = lockedProp;

  const isInitialMount = useRef(true);
  const prevDirection = useRef(direction);
  const prevStageIds = useRef<string[]>([]);
  // Use ref so the sync effect always reads the latest saved positions
  const savedPositionsRef = useRef(savedPositions);
  savedPositionsRef.current = savedPositions;

  const buildNodeData = useCallback((s: ProjectStage): StageNodeData => ({
    label: s.name,
    status: s.status,
    readOnly,
    isAdmin,
    isWorker,
    assignedWorkerName: s.assigned_to ? (workerNames?.[s.assigned_to] || "Unknown") : null,
    estimatedCompletion: s.estimated_completion,
    onStart: () => onUpdateStatus?.(s.id, "in_progress"),
    onComplete: () => onUpdateStatus?.(s.id, "completed"),
    onDelete: () => onRemoveStage?.(s.id),
    onAssignWorker: () => onAssignWorker?.(s.id),
    onEdit: () => onEditStage?.(s.id),
    hideWorkerName: visibilitySettings?.show_worker_names === false,
    hideEstimatedCompletion: visibilitySettings?.show_estimated_completion === false,
    hideStatusText: visibilitySettings?.show_stage_status === false,
    totalMinutes: timeByStage?.[s.id] || 0,
  }), [readOnly, isAdmin, isWorker, workerNames, onUpdateStatus, onRemoveStage, onAssignWorker, onEditStage, visibilitySettings, timeByStage]);

  const rawNodes: Node[] = sorted.map((s, i) => ({
    id: s.id,
    type: i === 0 ? "starter" : "stage",
    position: { x: 0, y: 0 },
    draggable: !readOnly && !locked,
    data: buildNodeData(s),
  }));

  const rawEdges: Edge[] = useMemo(() => {
    if (dependencies && dependencies.length > 0) {
      return dependencies.map((dep) => ({
        id: `dep-${dep.id}`,
        source: dep.source_stage_id,
        target: dep.target_stage_id,
        type: "floating",
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "hsl(var(--primary))",
          width: 12,
          height: 12,
        },
        style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
        data: { dependencyId: dep.id },
      }));
    }
    // Fallback: sequential edges based on position
    return sorted.slice(1).map((s, i) => ({
      id: `e-${sorted[i].id}-${s.id}`,
      source: sorted[i].id,
      target: s.id,
      type: "floating",
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "hsl(var(--primary))",
        width: 12,
        height: 12,
      },
      style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
    }));
  }, [dependencies, sorted]);

  // Build initial nodes with saved positions so React Flow's first render has correct positions.
  // useNodesState wraps useState, so this only applies on mount.
  const initialNodes = useRef(
    sorted.map((s, i) => ({
      id: s.id,
      type: i === 0 ? "starter" : "stage",
      position: savedPositions?.[s.id] || { x: 0, y: 0 },
      draggable: !readOnly && !locked,
      data: buildNodeData(s),
    }))
  ).current;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([] as Edge[]);

  // Wire up edge deletion ref so FloatingEdge can remove edges
  const deleteEdge = useCallback((edgeId: string) => {
    // If this is a dependency edge, also remove from DB
    if (edgeId.startsWith("dep-") && onRemoveDependency) {
      const depId = edgeId.replace("dep-", "");
      onRemoveDependency(depId);
    }
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
  }, [setEdges, onRemoveDependency]);

  useEffect(() => {
    deleteEdgeRef.current = readOnly ? null : deleteEdge;
    return () => { deleteEdgeRef.current = null; };
  }, [readOnly, deleteEdge]);

  // Handle new connections drawn by the user
  const onConnect = useCallback((connection: Connection) => {
    const newEdge: Edge = {
      ...connection,
      id: `e-${connection.source}-${connection.target}`,
      type: "floating",
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "hsl(var(--primary))",
        width: 20,
        height: 20,
      },
      style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
    };
    setEdges((eds) => addEdge(newEdge, eds));
    // Persist the dependency
    if (onAddDependency && connection.source && connection.target) {
      onAddDependency(connection.source, connection.target);
    }
  }, [setEdges, onAddDependency]);

  // Debounced position save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savePositions = useCallback(() => {
    if (!onPositionsChange) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const map: Record<string, { x: number; y: number }> = {};
      // Read from latest nodes state via setter callback
      setNodes((nds) => {
        nds.forEach((n) => { map[n.id] = n.position; });
        return nds; // no change
      });
      if (Object.keys(map).length > 0) {
        onPositionsChange(map);
      }
    }, 500);
  }, [onPositionsChange, setNodes]);

  // Run ELK layout (async), then fit view so all nodes are visible
  const runLayout = useCallback(async (layoutNodes: Node[], layoutEdges: Edge[], dir: "TB" | "LR", save = true) => {
    const { nodes: ln, edges: le } = await getLayoutedElements(layoutNodes, layoutEdges, dir);
    setNodes(ln);
    setEdges(le);
    setTimeout(() => fitView({ padding: 0.3, duration: 200 }), 50);
    if (save) {
      setTimeout(() => {
        if (onPositionsChange) {
          const map: Record<string, { x: number; y: number }> = {};
          ln.forEach((n) => { map[n.id] = n.position; });
          onPositionsChange(map);
        }
      }, 100);
    }
  }, [setNodes, setEdges, fitView, onPositionsChange]);

  // Sync nodes/edges when stages change, preserving user-dragged positions
  useEffect(() => {
    const currentIds = sorted.map((s) => s.id);
    const directionChanged = prevDirection.current !== direction;
    prevDirection.current = direction;

    // Initial mount: nodes already have saved positions from useNodesState init.
    // Just need to set edges, and run ELK only if no saved positions.
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevStageIds.current = currentIds;

      const sp = savedPositionsRef.current;
      const hasSavedPositions = sp && Object.keys(sp).length > 0 && currentIds.every((id) => sp[id]);
      if (hasSavedPositions) {
        // Nodes already initialized with saved positions, just set edges
        setEdges(rawEdges);
        return;
      }
      // No saved positions — run ELK layout
      runLayout(rawNodes, rawEdges, direction, true);
      return;
    }

    // Direction change → full ELK layout
    if (directionChanged) {
      prevStageIds.current = currentIds;
      runLayout(rawNodes, rawEdges, direction, true);
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

    // Fit view after adding new nodes (slight delay so React Flow measures them first)
    if (addedIds.length > 0) {
      setTimeout(() => fitView({ padding: 0.3, duration: 200 }), 50);
      // Save positions for newly added nodes
      savePositions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages.map((s) => `${s.id}:${s.status}:${s.assigned_to}:${s.estimated_completion}`).join(","), direction]);

  // Update node draggable when locked changes
  useEffect(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, draggable: !readOnly && !locked })));
  }, [locked, readOnly, setNodes]);

  // Wrap onNodesChange: block position changes when locked, save on drag end
  const handleNodesChange = useCallback((changes: any[]) => {
    if (readOnly) return;
    if (locked) {
      // When locked, only allow non-position changes (e.g. selection)
      const filtered = changes.filter((c: any) => c.type !== "position");
      if (filtered.length > 0) onNodesChange(filtered);
      return;
    }
    onNodesChange(changes);
    const hasDragEnd = changes.some((c: any) => c.type === "position" && c.dragging === false);
    if (hasDragEnd) {
      savePositions();
    }
  }, [onNodesChange, savePositions, locked, readOnly]);

  // Wrap onEdgesChange: block when locked
  const handleEdgesChange = useCallback((changes: any[]) => {
    if (readOnly || locked) return;
    onEdgesChange(changes);
  }, [onEdgesChange, locked, readOnly]);

  const handleAutoAlign = useCallback(() => {
    prevStageIds.current = sorted.map((s) => s.id);
    runLayout(rawNodes, rawEdges, direction, true);
  }, [sorted, rawNodes, rawEdges, direction, runLayout]);

  return (
    <div className="relative w-full" style={{ height: isMobile ? 400 : 600 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={readOnly || locked ? undefined : onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={!readOnly && !locked}
        nodesConnectable={!readOnly && !locked}
        elementsSelectable={!readOnly}
        className="rounded-lg border bg-background"
      >
        <Controls showInteractive={false} />
        <Background gap={16} size={1} />
        {progress !== undefined && (
          <Panel position="top-center">
            <div className="bg-background/90 backdrop-blur rounded-lg border shadow-sm px-3 py-1.5 flex items-center gap-2 w-48 sm:w-56">
              <div className="flex-1 bg-secondary rounded-full h-2 min-w-0">
                <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs text-muted-foreground font-medium">{progress}%</span>
            </div>
          </Panel>
        )}
        {!readOnly && (
          <Panel position="top-right">
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                className="bg-background shadow-sm"
                onClick={handleAutoAlign}
                title="Auto-align nodes"
                disabled={locked}
              >
                <AlignHorizontalDistributeCenter className="h-4 w-4 mr-1" />
                Auto Align
              </Button>
              {isAdmin && (
                <Button
                  size="sm"
                  variant={locked ? "default" : "outline"}
                  className={locked ? "shadow-sm" : "bg-background shadow-sm"}
                  onClick={() => {
                    if (!locked) {
                      // When locking, capture current positions and pass them along
                      const posMap: Record<string, { x: number; y: number }> = {};
                      nodes.forEach((n) => { posMap[n.id] = n.position; });
                      onLockedChange?.(true, posMap);
                    } else {
                      onLockedChange?.(false);
                    }
                  }}
                  title={locked ? "Unlock positions" : "Lock positions"}
                >
                  {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </Panel>
        )}
        {!readOnly && isAdmin && onAddStage && (
          <Panel position={isMobile ? "bottom-right" : "bottom-center"}>
            <Button
              size="sm"
              variant="outline"
              className="bg-background shadow-sm"
              onClick={onAddStage}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Stage
            </Button>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

export function WorkflowCanvas(props: WorkflowCanvasProps) {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
