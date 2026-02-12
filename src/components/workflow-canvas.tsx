"use client";

import { useCallback, useMemo, useState } from "react";
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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { WorkflowNode, WorkflowEdge, Worker } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, CheckCircle2, Trash2, Clock, Loader2, User, Plus } from "lucide-react";
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
  workers: Worker[];
  readOnly?: boolean;
  onStatusChange: (nodeId: string, status: WorkflowNode["status"]) => void;
  onAssignWorker: (nodeId: string, workerId: string) => void;
  onRemove: (nodeId: string) => void;
  [key: string]: unknown;
}

function StatusIcon({ status }: { status: WorkflowNode["status"] }) {
  if (status === "completed") return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
  if (status === "in-progress") return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
}

function StageNode({ id, data }: NodeProps<Node<StageNodeData>>) {
  const assignedWorker = data.workers.find((w) => w.id === data.assignedTo);

  const borderColor =
    data.status === "completed"
      ? "border-green-500"
      : data.status === "in-progress"
      ? "border-blue-500"
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
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
      {/* Header with status stripe */}
      <div className={`${headerBg} px-3 py-2 flex items-center justify-between gap-2`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <StatusIcon status={data.status} />
          <span className="font-semibold text-sm truncate">{data.label}</span>
        </div>
        <Badge
          variant={
            data.status === "completed"
              ? "default"
              : data.status === "in-progress"
              ? "secondary"
              : "outline"
          }
          className="shrink-0 text-[10px] uppercase tracking-wide"
        >
          {data.status}
        </Badge>
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
        {/* Actions */}
        <div className="flex items-center gap-1">
          {data.status === "pending" && !data.readOnly && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs flex-1"
              onClick={() => data.onStatusChange(id, "in-progress")}
            >
              <Play className="h-3 w-3 mr-1" /> Start
            </Button>
          )}
          {data.status === "in-progress" && !data.readOnly && (
            <Button
              size="sm"
              className="h-7 text-xs flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => data.onStatusChange(id, "completed")}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
            </Button>
          )}
          {data.status === "completed" && (
            <span className="text-xs text-green-600 font-medium flex-1 text-center">✓ Done</span>
          )}
          {data.status === "pending" && data.readOnly && (
            <span className="text-xs text-muted-foreground font-medium flex-1 text-center">Pending</span>
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
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3" />
    </div>
  );
}

const nodeTypes: NodeTypes = { stage: StageNode };

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  workers: Worker[];
  onNodesUpdate: (nodes: WorkflowNode[]) => void;
  onEdgesUpdate: (edges: WorkflowEdge[]) => void;
  onStatusChange: (nodeId: string, status: WorkflowNode["status"]) => void;
  onAssignWorker: (nodeId: string, workerId: string) => void;
  onRemoveNode: (nodeId: string) => void;
  onAddNode?: (label: string, position: { x: number; y: number }) => void;
  readOnly?: boolean;
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
  onAddNode,
  readOnly = false,
}: WorkflowCanvasProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addPosition, setAddPosition] = useState<{ x: number; y: number }>({ x: 250, y: 100 });
  const [newStageLabel, setNewStageLabel] = useState("");
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
          workers,
          readOnly,
          onStatusChange,
          onAssignWorker,
          onRemove: onRemoveNode,
        },
      })),
    [wfNodes, workers, onStatusChange, onAssignWorker, onRemoveNode]
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      wfEdges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        animated: true,
      })),
    [wfEdges]
  );

  const [flowNodes, setFlowNodes] = useState(rfNodes);
  const [flowEdges, setFlowEdges] = useState(rfEdges);

  // Sync when props change
  useMemo(() => {
    setFlowNodes(rfNodes);
    setFlowEdges(rfEdges);
  }, [rfNodes, rfEdges]);

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
        return updated;
      });
    },
    []
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      setFlowEdges((eds) => {
        const newEdges = addEdge({ ...params, type: "smoothstep", animated: true }, eds);
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
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          nodeColor={(n) => {
            const data = n.data as StageNodeData;
            if (data.status === "completed") return "#22c55e";
            if (data.status === "in-progress") return "#3b82f6";
            return "#94a3b8";
          }}
        />
      </ReactFlow>
      {/* Floating add button */}
      {!readOnly && onAddNode && (
        <Button
          size="sm"
          className="absolute top-3 right-3 z-10 shadow-md"
          onClick={handleToolbarAdd}
        >
          <Plus className="h-4 w-4 mr-1" /> Add Stage
        </Button>
      )}
      {/* Add stage dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Stage</DialogTitle>
            <DialogDescription>Enter a name for the new workflow stage</DialogDescription>
          </DialogHeader>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
