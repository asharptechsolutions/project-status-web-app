"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeTypes,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Handle,
  Position,
  type NodeProps,
  type EdgeProps,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { WorkflowNode as WorkflowNodeType, WorkflowEdge, Worker, PresetStage } from "@/lib/types";
type WorkflowNode = WorkflowNodeType;
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, CheckCircle2, Trash2, Clock, Loader2, User, Plus, LayoutGrid, Lock, Unlock, CalendarDays, Pencil } from "lucide-react";
import Dagre from "@dagrejs/dagre";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface StageNodeData {
  label: string;
  status: WorkflowNode["status"];
  assignedTo?: string;
  estimatedCompletion?: string;
  workers: Worker[];
  readOnly?: boolean;
  blocked?: boolean;
  blockedBy?: string[];
  onStatusChange: (nodeId: string, status: WorkflowNode["status"]) => void;
  onAssignWorker: (nodeId: string, workerId: string) => void;
  onRemove: (nodeId: string) => void;
  onEstimatedCompletionChange: (nodeId: string, date: string) => void;
  onRenameNode: (nodeId: string, label: string) => void;
  onEditNode: (nodeId: string) => void;
  direction?: "TB" | "LR";
  isSource?: boolean;
  [key: string]: unknown;
}

function StatusIcon({ status }: { status: WorkflowNode["status"] }) {
  if (status === "completed") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  if (status === "in-progress") return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
}

function StageNode({ id, data }: NodeProps<Node<StageNodeData>>) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(data.label);
  const assignedWorker = data.workers.find((w) => w.id === data.assignedTo);

  const borderColor =
    data.status === "completed"
      ? "border-green-500"
      : data.status === "in-progress"
      ? "border-blue-500"
      : data.blocked
      ? "border-amber-400"
      : "border-border";
  const bgColor =
    data.status === "completed"
      ? "bg-green-500/10"
      : data.status === "in-progress"
      ? "bg-blue-500/10"
      : "bg-card";
  const headerBg =
    data.status === "completed"
      ? "bg-green-500/20"
      : data.status === "in-progress"
      ? "bg-blue-500/20"
      : "bg-muted/50";

  return (
    <div className={`rounded-lg border-2 ${borderColor} ${bgColor} min-w-[220px] max-w-[270px] shadow-md overflow-hidden`}>
      {!data.isSource && <Handle type="target" position={data.direction === "LR" ? Position.Left : Position.Top} className="!bg-primary !w-3 !h-3" />}
      {/* Header with status stripe */}
      <div className={`${headerBg} px-3 py-2 flex items-center justify-between gap-2`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <StatusIcon status={data.status} />
          {editing && !data.readOnly ? (
            <input
              className="font-semibold text-sm bg-transparent border-b border-primary outline-none min-w-0 w-full"
              value={editLabel}
              autoFocus
              onChange={(e) => setEditLabel(e.target.value)}
              onBlur={() => {
                setEditing(false);
                const trimmed = editLabel.trim();
                if (trimmed && trimmed !== data.label) data.onRenameNode(id, trimmed);
                else setEditLabel(data.label);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") { setEditLabel(data.label); setEditing(false); }
              }}
            />
          ) : (
            <span
              className={`font-semibold text-sm truncate ${!data.readOnly ? "cursor-pointer hover:underline" : ""}`}
              onDoubleClick={() => { if (!data.readOnly) { setEditLabel(data.label); setEditing(true); } }}
            >
              {data.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!data.readOnly && (
            <button
              className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => data.onEditNode(id)}
              title="Edit stage"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          <Badge
            variant={
              data.status === "completed"
                ? "default"
                : data.status === "in-progress"
                ? "secondary"
                : "outline"
            }
            className="text-[10px] uppercase tracking-wide"
          >
            {data.status}
          </Badge>
        </div>
      </div>
      {/* Body */}
      <div className="p-3 flex flex-col gap-2">
        {/* Assigned worker display */}
        {assignedWorker ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span>{assignedWorker.name}</span>
          </div>
        ) : null}
        {/* Worker assignment (hidden in read-only) */}
        {!data.readOnly && (
          <Select
            value={data.assignedTo || ""}
            onValueChange={(v) => data.onAssignWorker(id, v)}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder={assignedWorker ? "Reassign" : "Assign worker"} />
            </SelectTrigger>
            <SelectContent>
              {data.workers.map((w) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {/* Blocked indicator */}
        {data.blocked && data.status === "pending" && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded">
            <Lock className="h-3 w-3 shrink-0" />
            <span className="truncate">Waiting on: {data.blockedBy?.join(", ")}</span>
          </div>
        )}
        {!data.blocked && data.status === "pending" && !data.readOnly && (
          <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <Unlock className="h-3 w-3" />
            <span>Ready to start</span>
          </div>
        )}
        {/* Estimated Completion */}
        {data.status !== "completed" && !data.readOnly && (
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3 w-3 text-muted-foreground shrink-0" />
            <input
              type="date"
              className="h-6 text-xs bg-transparent border border-border rounded px-1.5 w-full focus:outline-none focus:ring-1 focus:ring-primary"
              value={data.estimatedCompletion || ""}
              onChange={(e) => data.onEstimatedCompletionChange(id, e.target.value)}
              placeholder="Est. completion"
            />
          </div>
        )}
        {data.estimatedCompletion && data.status !== "completed" && data.readOnly && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="h-3 w-3" />
            <span>Est. {new Date(data.estimatedCompletion + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
        )}
        {data.estimatedCompletion && !data.readOnly && (
          <div className="text-[10px] text-muted-foreground pl-[18px]">
            Est. {new Date(data.estimatedCompletion + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </div>
        )}
        {/* Actions */}
        <div className="flex items-center gap-1">
          {data.status === "pending" && !data.readOnly && !data.blocked && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs flex-1"
              onClick={() => data.onStatusChange(id, "in-progress")}
            >
              <Play className="h-3 w-3 mr-1" /> Start
            </Button>
          )}
          {data.status === "pending" && !data.readOnly && data.blocked && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs flex-1 opacity-50 cursor-not-allowed"
              disabled
            >
              <Lock className="h-3 w-3 mr-1" /> Blocked
            </Button>
          )}
          {data.status === "in-progress" && !data.readOnly && (
            <Button
              size="sm"
              className="h-7 text-xs flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => data.onStatusChange(id, "completed")}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" /> Mark Complete
            </Button>
          )}
          {data.status === "completed" && (
            <span className="text-xs text-green-600 font-medium flex-1 text-center">✓ Done</span>
          )}
          {data.status === "pending" && data.readOnly && data.blocked && (
            <span className="text-xs text-amber-600 font-medium flex-1 text-center">⏳ Blocked</span>
          )}
          {data.status === "pending" && data.readOnly && !data.blocked && (
            <span className="text-xs text-muted-foreground font-medium flex-1 text-center">Ready</span>
          )}
          {data.status === "in-progress" && data.readOnly && (
            <span className="text-xs text-blue-500 font-medium flex-1 text-center">In Progress</span>
          )}
          {!data.readOnly && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 shrink-0 text-destructive hover:text-destructive"
              onClick={() => data.onRemove(id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      <Handle type="source" position={data.direction === "LR" ? Position.Right : Position.Bottom} className="!bg-primary !w-3 !h-3" />
    </div>
  );
}

function DeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onDelete = data?.onDelete as ((id: string) => void) | undefined;

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeWidth: selected ? 3 : 2 }} />
      {selected && onDelete && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
          >
            <button
              className="flex items-center justify-center w-5 h-5 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80 shadow-md text-xs font-bold"
              onClick={() => onDelete(id)}
              title="Delete edge"
            >
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const nodeTypes: NodeTypes = { stage: StageNode };
const edgeTypes = { deletable: DeletableEdge };

function getLayoutedElements(
  nodes: Node<StageNodeData>[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB"
) {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 100 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 250, height: 160 });
  });

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target);
  });

  Dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return { ...node, position: { x: pos.x - 125, y: pos.y - 80 } };
  });

  return layoutedNodes;
}

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  workers: Worker[];
  onNodesUpdate: (nodes: WorkflowNode[]) => void;
  onEdgesUpdate: (edges: WorkflowEdge[]) => void;
  onStatusChange: (nodeId: string, status: WorkflowNode["status"]) => void;
  onAssignWorker: (nodeId: string, workerId: string) => void;
  onRemoveNode: (nodeId: string) => void;
  onEstimatedCompletionChange: (nodeId: string, date: string) => void;
  onRenameNode?: (nodeId: string, label: string) => void;
  onAddNode?: (label: string, position: { x: number; y: number }) => void;
  readOnly?: boolean;
  presetStages?: PresetStage[];
}

export function WorkflowCanvas({
  nodes: wfNodes,
  edges: wfEdges,
  workers,
  onNodesUpdate,
  onEdgesUpdate,
  onStatusChange,
  onAssignWorker,
  onRemoveNode,
  onEstimatedCompletionChange,
  onRenameNode,
  onAddNode,
  readOnly = false,
  presetStages = [],
}: WorkflowCanvasProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addPosition, setAddPosition] = useState<{ x: number; y: number }>({ x: 250, y: 100 });
  const [newStageLabel, setNewStageLabel] = useState("");
  const [editingNode, setEditingNode] = useState<WorkflowNode | null>(null);
  const [editForm, setEditForm] = useState({ label: "", status: "" as WorkflowNode["status"], assignedTo: "", estimatedCompletion: "" });

  // Responsive layout direction: horizontal (LR) on desktop, vertical (TB) on mobile
  const [direction, setDirection] = useState<"TB" | "LR">("TB");
  useEffect(() => {
    const update = () => setDirection(window.innerWidth >= 768 ? "LR" : "TB");
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  const handleEditNode = useCallback((nodeId: string) => {
    const node = wfNodes.find((n) => n.id === nodeId);
    if (!node) return;
    setEditingNode(node);
    setEditForm({
      label: node.label,
      status: node.status,
      assignedTo: node.assignedTo || "",
      estimatedCompletion: node.estimatedCompletion || "",
    });
  }, [wfNodes]);

  const handleEditSave = useCallback(() => {
    if (!editingNode) return;
    const trimmedLabel = editForm.label.trim();
    if (trimmedLabel && trimmedLabel !== editingNode.label && onRenameNode) {
      onRenameNode(editingNode.id, trimmedLabel);
    }
    if (editForm.status !== editingNode.status) {
      onStatusChange(editingNode.id, editForm.status);
    }
    if (editForm.assignedTo !== (editingNode.assignedTo || "")) {
      onAssignWorker(editingNode.id, editForm.assignedTo);
    }
    if (editForm.estimatedCompletion !== (editingNode.estimatedCompletion || "")) {
      onEstimatedCompletionChange(editingNode.id, editForm.estimatedCompletion);
    }
    setEditingNode(null);
  }, [editingNode, editForm, onRenameNode, onStatusChange, onAssignWorker, onEstimatedCompletionChange]);

  // Compute which nodes are blocked (predecessors not all completed)
  const blockedMap = useMemo(() => {
    const map: Record<string, { blocked: boolean; blockedBy: string[] }> = {};
    for (const n of wfNodes) {
      const incomingEdges = wfEdges.filter((e) => e.target === n.id);
      if (incomingEdges.length === 0) {
        map[n.id] = { blocked: false, blockedBy: [] };
      } else {
        const predecessors = incomingEdges.map((e) => wfNodes.find((wn) => wn.id === e.source)).filter(Boolean) as WorkflowNode[];
        const incomplete = predecessors.filter((p) => p.status !== "completed");
        map[n.id] = {
          blocked: incomplete.length > 0,
          blockedBy: incomplete.map((p) => p.label),
        };
      }
    }
    return map;
  }, [wfNodes, wfEdges]);

  const rfNodes: Node<StageNodeData>[] = useMemo(
    () =>
      wfNodes.map((n, i) => ({
        id: n.id,
        type: "stage",
        position: n.position || { x: 250, y: i * 160 },
        data: {
          label: n.label,
          status: n.status,
          assignedTo: n.assignedTo,
          estimatedCompletion: n.estimatedCompletion,
          workers,
          readOnly,
          direction,
          blocked: blockedMap[n.id]?.blocked ?? false,
          blockedBy: blockedMap[n.id]?.blockedBy ?? [],
          isSource: i === 0 && !wfEdges.some((e) => e.target === n.id),
          onStatusChange,
          onAssignWorker,
          onRemove: onRemoveNode,
          onEstimatedCompletionChange,
          onRenameNode: onRenameNode || (() => {}),
          onEditNode: handleEditNode,
        },
      })),
    [wfNodes, workers, onStatusChange, onAssignWorker, onRemoveNode, onEstimatedCompletionChange, onRenameNode, handleEditNode, blockedMap, direction]
  );

  const deleteEdgeRef = useRef<(edgeId: string) => void>(() => {});

  const rfEdges: Edge[] = useMemo(
    () =>
      wfEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: readOnly ? "smoothstep" : "deletable",
        animated: true,
        data: readOnly ? {} : { onDelete: (id: string) => deleteEdgeRef.current(id) },
      })),
    [wfEdges, readOnly]
  );

  // Auto-layout nodes in readOnly mode for clean presentation
  const initialNodes = useMemo(() => {
    if (readOnly && rfNodes.length > 0) {
      return getLayoutedElements(rfNodes, rfEdges, direction);
    }
    return rfNodes;
  }, [readOnly, rfNodes, rfEdges, direction]);

  const [flowNodes, setFlowNodes] = useState(initialNodes);
  const [flowEdges, setFlowEdges] = useState(rfEdges);

  // Wire up the edge delete handler now that setFlowEdges is available
  deleteEdgeRef.current = (edgeId: string) => {
    if (readOnly) return;
    setFlowEdges((eds) => {
      const updated = eds.filter((e) => e.id !== edgeId);
      const wfNew = updated.map((e) => ({ id: e.id, source: e.source, target: e.target }));
      onEdgesUpdate(wfNew);
      return updated;
    });
  };

  // Sync when props change
  useMemo(() => {
    if (readOnly && rfNodes.length > 0) {
      setFlowNodes(getLayoutedElements(rfNodes, rfEdges, direction));
    } else {
      setFlowNodes(rfNodes);
    }
    setFlowEdges(rfEdges);
  }, [rfNodes, rfEdges, readOnly, direction]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setFlowNodes((nds) => {
        const updated = applyNodeChanges(changes, nds) as Node<StageNodeData>[];
        // Persist position changes back
        const hasDrag = changes.some((c) => c.type === "position" && c.dragging === false);
        if (hasDrag) {
          const wfUpdated = wfNodes.map((wn) => {
            const rfNode = updated.find((u) => u.id === wn.id);
            return rfNode ? { ...wn, position: rfNode.position } : wn;
          });
          onNodesUpdate(wfUpdated);
        }
        return updated;
      });
    },
    [wfNodes, onNodesUpdate]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      setFlowEdges((eds) => {
        const updated = applyEdgeChanges(changes, eds);
        // Persist edge removals back to parent
        const hasRemoval = changes.some((c) => c.type === "remove");
        if (hasRemoval) {
          const wfNew = updated.map((e) => ({ id: e.id, source: e.source, target: e.target }));
          onEdgesUpdate(wfNew);
        }
        return updated;
      });
    },
    [onEdgesUpdate]
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      setFlowEdges((eds) => {
        const newEdges = addEdge({ ...params, type: "deletable", animated: true, data: { onDelete: (id: string) => deleteEdgeRef.current(id) } }, eds);
        const wfNew = newEdges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
        onEdgesUpdate(wfNew);
        return newEdges;
      });
    },
    [onEdgesUpdate]
  );

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if (readOnly || !onAddNode) return;
      // Get canvas position from the ReactFlow viewport
      const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      setAddPosition({ x, y });
      setNewStageLabel("");
      setShowAddDialog(true);
    },
    [readOnly, onAddNode]
  );

  const handleAddSubmit = useCallback(() => {
    if (!newStageLabel.trim() || !onAddNode) return;
    onAddNode(newStageLabel.trim(), addPosition);
    setNewStageLabel("");
    setShowAddDialog(false);
  }, [newStageLabel, addPosition, onAddNode]);

  const handleAutoLayout = useCallback(() => {
    const layouted = getLayoutedElements(flowNodes, flowEdges, direction);
    setFlowNodes(layouted);
    // Persist positions back
    const wfUpdated = wfNodes.map((wn) => {
      const rfNode = layouted.find((u) => u.id === wn.id);
      return rfNode ? { ...wn, position: rfNode.position } : wn;
    });
    onNodesUpdate(wfUpdated);
  }, [flowNodes, flowEdges, wfNodes, onNodesUpdate, direction]);

  const handleToolbarAdd = useCallback(() => {
    if (!onAddNode) return;
    // Place new node below existing nodes
    const maxY = wfNodes.reduce((max, n) => Math.max(max, n.position?.y ?? 0), 0);
    setAddPosition({ x: 250, y: maxY + 160 });
    setNewStageLabel("");
    setShowAddDialog(true);
  }, [onAddNode, wfNodes]);

  return (
    <div className="w-full h-[500px] border rounded-lg overflow-hidden bg-background relative">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        onPaneClick={undefined}
        onDoubleClick={!readOnly ? handleDoubleClick : undefined}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        {!readOnly && (
          <>
            <Controls />
            <div className="hidden md:block">
              <MiniMap
                nodeStrokeWidth={3}
                nodeColor={(n) => {
                  const data = n.data as StageNodeData;
                  if (data.status === "completed") return "#22c55e";
                  if (data.status === "in-progress") return "#3b82f6";
                  return "#94a3b8";
                }}
              />
            </div>
          </>
        )}
      </ReactFlow>
      {/* Floating toolbar */}
      {!readOnly && (
        <div className="absolute top-3 right-3 z-10 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="shadow-md"
            onClick={handleAutoLayout}
          >
            <LayoutGrid className="h-4 w-4 mr-1" /> Auto Layout
          </Button>
          {onAddNode && (
            <Button
              size="sm"
              className="shadow-md"
              onClick={handleToolbarAdd}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Stage
            </Button>
          )}
        </div>
      )}
      {/* Add stage dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Stage</DialogTitle>
            <DialogDescription>Enter a name for the new workflow stage</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Stage name (e.g. Quality Check)"
                value={newStageLabel}
                onChange={(e) => setNewStageLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSubmit()}
                autoFocus
              />
              <Button onClick={handleAddSubmit} disabled={!newStageLabel.trim()}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            {presetStages.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Or pick a preset:</p>
                <div className="flex flex-wrap gap-2">
                  {presetStages.map((ps) => (
                    <Button
                      key={ps.id}
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setNewStageLabel(ps.name);
                        if (onAddNode && addPosition) {
                          onAddNode(ps.name, addPosition);
                          setShowAddDialog(false);
                          setNewStageLabel("");
                        }
                      }}
                    >
                      {ps.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Edit stage dialog */}
      <Dialog open={!!editingNode} onOpenChange={(open) => { if (!open) setEditingNode(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stage</DialogTitle>
            <DialogDescription>Update the details for this workflow stage</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={editForm.label}
                onChange={(e) => setEditForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Stage name"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Status</label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v as WorkflowNode["status"] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Assigned To</label>
              <Select value={editForm.assignedTo} onValueChange={(v) => setEditForm((f) => ({ ...f, assignedTo: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {workers.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Estimated Completion</label>
              <input
                type="date"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={editForm.estimatedCompletion}
                onChange={(e) => setEditForm((f) => ({ ...f, estimatedCompletion: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditingNode(null)}>Cancel</Button>
              <Button onClick={handleEditSave}>Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
