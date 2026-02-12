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
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, LayoutGrid, GripVertical } from "lucide-react";
import Dagre from "@dagrejs/dagre";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type TemplateNode = Omit<WorkflowNode, "status" | "startedAt" | "completedAt">;

interface TemplateStageData {
  label: string;
  onRemove: (id: string) => void;
  onRename: (id: string, label: string) => void;
  [key: string]: unknown;
}

function TemplateStageNode({ id, data }: NodeProps<Node<TemplateStageData>>) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(data.label);

  const handleSubmit = () => {
    if (label.trim()) {
      data.onRename(id, label.trim());
    } else {
      setLabel(data.label);
    }
    setEditing(false);
  };

  return (
    <div className="rounded-lg border-2 border-border bg-card min-w-[200px] max-w-[250px] shadow-md overflow-hidden">
      <Handle type="target" position={Position.Top} className="!bg-primary !w-3 !h-3" />
      <div className="bg-muted/50 px-3 py-2 flex items-center justify-between gap-2">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0 cursor-grab" />
        {editing ? (
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="h-6 text-sm font-semibold px-1"
            autoFocus
          />
        ) : (
          <span
            className="font-semibold text-sm truncate flex-1 cursor-pointer"
            onDoubleClick={() => setEditing(true)}
            title="Double-click to rename"
          >
            {data.label}
          </span>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 shrink-0 text-destructive hover:text-destructive"
          onClick={() => data.onRemove(id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-3 !h-3" />
    </div>
  );
}

const nodeTypes: NodeTypes = { templateStage: TemplateStageNode };

function getLayoutedElements(nodes: Node<TemplateStageData>[], edges: Edge[]) {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80 });
  nodes.forEach((node) => g.setNode(node.id, { width: 220, height: 60 }));
  edges.forEach((edge) => g.setEdge(edge.source, edge.target));
  Dagre.layout(g);
  return nodes.map((node) => {
    const pos = g.node(node.id);
    return { ...node, position: { x: pos.x - 110, y: pos.y - 30 } };
  });
}

interface TemplateCanvasProps {
  nodes: TemplateNode[];
  edges: WorkflowEdge[];
  onNodesChange: (nodes: TemplateNode[]) => void;
  onEdgesChange: (edges: WorkflowEdge[]) => void;
}

export function TemplateCanvas({
  nodes: tplNodes,
  edges: tplEdges,
  onNodesChange: onTplNodesChange,
  onEdgesChange: onTplEdgesChange,
}: TemplateCanvasProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addPosition, setAddPosition] = useState({ x: 250, y: 100 });
  const [newLabel, setNewLabel] = useState("");

  const handleRemove = useCallback(
    (nodeId: string) => {
      onTplNodesChange(tplNodes.filter((n) => n.id !== nodeId));
      onTplEdgesChange(tplEdges.filter((e) => e.source !== nodeId && e.target !== nodeId));
    },
    [tplNodes, tplEdges, onTplNodesChange, onTplEdgesChange]
  );

  const handleRename = useCallback(
    (nodeId: string, label: string) => {
      onTplNodesChange(tplNodes.map((n) => (n.id === nodeId ? { ...n, label } : n)));
    },
    [tplNodes, onTplNodesChange]
  );

  const rfNodes: Node<TemplateStageData>[] = useMemo(
    () =>
      tplNodes.map((n, i) => ({
        id: n.id,
        type: "templateStage",
        position: n.position || { x: 250, y: i * 100 },
        data: { label: n.label, onRemove: handleRemove, onRename: handleRename },
      })),
    [tplNodes, handleRemove, handleRename]
  );

  const rfEdges: Edge[] = useMemo(
    () => tplEdges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: "smoothstep", animated: true })),
    [tplEdges]
  );

  const [flowNodes, setFlowNodes] = useState(rfNodes);
  const [flowEdges, setFlowEdges] = useState(rfEdges);

  useMemo(() => {
    setFlowNodes(rfNodes);
    setFlowEdges(rfEdges);
  }, [rfNodes, rfEdges]);

  const onNodesChangeRF: OnNodesChange = useCallback(
    (changes) => {
      setFlowNodes((nds) => {
        const updated = applyNodeChanges(changes, nds) as Node<TemplateStageData>[];
        const hasDrag = changes.some((c) => c.type === "position" && c.dragging === false);
        if (hasDrag) {
          onTplNodesChange(
            tplNodes.map((n) => {
              const rf = updated.find((u) => u.id === n.id);
              return rf ? { ...n, position: rf.position } : n;
            })
          );
        }
        return updated;
      });
    },
    [tplNodes, onTplNodesChange]
  );

  const onEdgesChangeRF: OnEdgesChange = useCallback(
    (changes) => {
      setFlowEdges((eds) => applyEdgeChanges(changes, eds));
    },
    []
  );

  const onConnect: OnConnect = useCallback(
    (params) => {
      setFlowEdges((eds) => {
        const newEdges = addEdge({ ...params, type: "smoothstep", animated: true }, eds);
        onTplEdgesChange(newEdges.map((e) => ({ id: e.id, source: e.source, target: e.target })));
        return newEdges;
      });
    },
    [onTplEdgesChange]
  );

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setAddPosition({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    setNewLabel("");
    setShowAddDialog(true);
  }, []);

  const handleAddSubmit = useCallback(() => {
    if (!newLabel.trim()) return;
    const id = Math.random().toString(36).slice(2, 10);
    const newNode: TemplateNode = { id, label: newLabel.trim(), position: addPosition };
    onTplNodesChange([...tplNodes, newNode]);
    setNewLabel("");
    setShowAddDialog(false);
  }, [newLabel, addPosition, tplNodes, onTplNodesChange]);

  const handleAutoLayout = useCallback(() => {
    const layouted = getLayoutedElements(flowNodes, flowEdges);
    setFlowNodes(layouted);
    onTplNodesChange(
      tplNodes.map((n) => {
        const rf = layouted.find((u) => u.id === n.id);
        return rf ? { ...n, position: rf.position } : n;
      })
    );
  }, [flowNodes, flowEdges, tplNodes, onTplNodesChange]);

  const handleToolbarAdd = useCallback(() => {
    const maxY = tplNodes.reduce((max, n) => Math.max(max, n.position?.y ?? 0), 0);
    setAddPosition({ x: 250, y: maxY + 100 });
    setNewLabel("");
    setShowAddDialog(true);
  }, [tplNodes]);

  return (
    <div className="w-full h-[400px] border rounded-lg overflow-hidden bg-background relative">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={onNodesChangeRF}
        onEdgesChange={onEdgesChangeRF}
        onConnect={onConnect}
        onDoubleClick={handleDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <div className="hidden md:block">
          <MiniMap nodeColor={() => "#6366f1"} />
        </div>
      </ReactFlow>
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <Button size="sm" variant="outline" className="shadow-md" onClick={handleAutoLayout}>
          <LayoutGrid className="h-4 w-4 mr-1" /> Auto Layout
        </Button>
        <Button size="sm" className="shadow-md" onClick={handleToolbarAdd}>
          <Plus className="h-4 w-4 mr-1" /> Add Stage
        </Button>
      </div>
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stage</DialogTitle>
            <DialogDescription>Enter a name for the new template stage</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="Stage name (e.g. Quality Check)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSubmit()}
              autoFocus
            />
            <Button onClick={handleAddSubmit} disabled={!newLabel.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
