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
import { Play, CheckCircle2, Trash2 } from "lucide-react";

interface StageNodeData {
  label: string;
  status: WorkflowNode["status"];
  assignedTo?: string;
  workers: Worker[];
  onStatusChange: (nodeId: string, status: WorkflowNode["status"]) => void;
  onAssignWorker: (nodeId: string, workerId: string) => void;
  onRemove: (nodeId: string) => void;
  [key: string]: unknown;
}

function StageNode({ id, data }: NodeProps<Node<StageNodeData>>) {
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

  return (
    <div className={`rounded-lg border-2 ${borderColor} ${bgColor} p-3 min-w-[200px] max-w-[260px] shadow-md`}>
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-medium text-sm truncate">{data.label}</span>
        <Badge
          variant={
            data.status === "completed"
              ? "default"
              : data.status === "in-progress"
              ? "secondary"
              : "outline"
          }
          className="shrink-0 text-xs"
        >
          {data.status}
        </Badge>
      </div>
      <div className="flex flex-col gap-1.5">
        <Select
          value={data.assignedTo || ""}
          onValueChange={(v) => data.onAssignWorker(id, v)}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Assign worker" />
          </SelectTrigger>
          <SelectContent>
            {data.workers.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          {data.status === "pending" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs flex-1"
              onClick={() => data.onStatusChange(id, "in-progress")}
            >
              <Play className="h-3 w-3 mr-1" /> Start
            </Button>
          )}
          {data.status === "in-progress" && (
            <Button
              size="sm"
              className="h-7 text-xs flex-1"
              onClick={() => data.onStatusChange(id, "completed")}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" /> Done
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 shrink-0"
            onClick={() => data.onRemove(id)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
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
  readOnly = false,
}: WorkflowCanvasProps) {
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

  return (
    <div className="w-full h-[500px] border rounded-lg overflow-hidden bg-background">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
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
    </div>
  );
}
