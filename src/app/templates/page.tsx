"use client";
import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getTemplates, createTemplate, updateTemplate, deleteTemplate, getPresetStages, createPresetStage, deletePresetStage } from "@/lib/firestore";
import type { WorkflowTemplate, WorkflowNode, WorkflowEdge, PresetStage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronRight, Pencil } from "lucide-react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { TemplateCanvas } from "@/components/template-canvas";

type TemplateNode = Omit<WorkflowNode, "status" | "startedAt" | "completedAt">;

const SAMPLE_TEMPLATES = [
  { name: "Standard Manufacturing", nodes: ["Process Order", "Order Supplies", "Metal Cutting", "Painting Station", "Final Prep", "Shipping"] },
  { name: "CNC Machining", nodes: ["Design Review", "Material Prep", "CNC Setup", "Machining", "Quality Check", "Deburring", "Shipping"] },
  { name: "Welding Job", nodes: ["Blueprint Review", "Material Cutting", "Tack Welding", "Full Welding", "Grinding", "Inspection", "Delivery"] },
];

function TemplatesInner() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null);
  const [name, setName] = useState("");
  const [canvasNodes, setCanvasNodes] = useState<TemplateNode[]>([]);
  const [canvasEdges, setCanvasEdges] = useState<WorkflowEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [presetStages, setPresetStages] = useState<PresetStage[]>([]);
  const [newPresetName, setNewPresetName] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [t, ps] = await Promise.all([getTemplates(user.uid), getPresetStages(user.uid)]);
      setTemplates(t);
      setPresetStages(ps);
    } catch (error: any) { toast.error(error.message || "Failed to load templates"); } finally { setLoading(false); }
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const resetCanvas = () => {
    setName("");
    setCanvasNodes([]);
    setCanvasEdges([]);
    setEditingTemplate(null);
  };

  const openCreate = () => {
    resetCanvas();
    setMode("create");
  };

  const openEdit = (t: WorkflowTemplate) => {
    setEditingTemplate(t);
    setName(t.name);
    // Ensure positions exist for existing nodes
    setCanvasNodes(t.nodes.map((n, i) => ({ ...n, position: n.position || { x: 250, y: i * 100 } })));
    setCanvasEdges([...t.edges]);
    setMode("edit");
  };

  const handleSave = async () => {
    if (!user || !name.trim() || canvasNodes.length === 0) {
      toast.error("Add a name and at least one stage");
      return;
    }
    try {
      if (mode === "edit" && editingTemplate) {
        await updateTemplate(editingTemplate.id, { name, nodes: canvasNodes, edges: canvasEdges });
        toast.success("Template updated");
      } else {
        await createTemplate({
          name,
          description: "",
          nodes: canvasNodes,
          edges: canvasEdges,
          userId: user.uid,
          createdAt: new Date().toISOString(),
        });
        toast.success("Template created");
      }
      resetCanvas();
      setMode("list");
      load();
    } catch (error: any) {
      toast.error(error.message || "Failed to save template");
    }
  };

  const handleUseSample = async (sample: typeof SAMPLE_TEMPLATES[0]) => {
    if (!user) return;
    const nodes: TemplateNode[] = sample.nodes.map((s, i) => ({ id: nanoid(8), label: s, position: { x: 250, y: i * 100 } }));
    const edges: WorkflowEdge[] = nodes.slice(0, -1).map((n, i) => ({ id: nanoid(8), source: n.id, target: nodes[i + 1].id }));
    try {
      await createTemplate({ name: sample.name, description: "", nodes, edges, userId: user.uid, createdAt: new Date().toISOString() });
      toast.success("Template added"); load();
    } catch (error: any) { toast.error(error.message || "Failed to add template"); }
  };

  if (loading) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  // Canvas builder view (create or edit)
  if (mode === "create" || mode === "edit") {
    return (
      <div className="p-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">{mode === "edit" ? "Edit Template" : "New Template"}</h1>
          <Button variant="outline" onClick={() => { resetCanvas(); setMode("list"); }}>Cancel</Button>
        </div>
        <div className="space-y-4">
          <div>
            <Label>Template Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Manufacturing" className="max-w-md" />
          </div>
          <div>
            <Label className="mb-2 block">Workflow Stages <span className="text-muted-foreground text-xs ml-1">(double-click canvas to add, drag between handles to connect)</span></Label>
            <TemplateCanvas
              nodes={canvasNodes}
              edges={canvasEdges}
              onNodesChange={setCanvasNodes}
              onEdgesChange={setCanvasEdges}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!name.trim() || canvasNodes.length === 0}>
              {mode === "edit" ? "Save Changes" : "Create Template"}
            </Button>
            {canvasNodes.length === 0 && (
              <p className="text-sm text-muted-foreground self-center">Click &quot;Add Stage&quot; or double-click the canvas to add stages</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="p-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Templates</h1>
        <Button onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> New Template</Button>
      </div>

      {templates.length === 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Quick Start — Sample Templates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SAMPLE_TEMPLATES.map((s) => (
              <Card key={s.name} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleUseSample(s)}>
                <CardContent className="pt-4 pb-4">
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.nodes.length} stages</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {s.nodes.map((n, i) => (
                      <span key={i} className="text-xs bg-secondary px-1.5 py-0.5 rounded">{n}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {templates.map((t) => (
          <Card key={t.id}>
            <CardContent className="pt-4 pb-4 flex items-center justify-between">
              <div>
                <p className="font-medium">{t.name}</p>
                <div className="flex items-center gap-1 mt-1">
                  {t.nodes.map((n, i) => (
                    <span key={n.id} className="flex items-center text-xs text-muted-foreground">
                      {n.label}{i < t.nodes.length - 1 && <ChevronRight className="h-3 w-3 mx-0.5" />}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(t)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={async () => { try { await deleteTemplate(t.id); toast.success("Template deleted"); load(); } catch (error: any) { toast.error(error.message || "Failed to delete template"); } }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Preset Stages Section */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold mb-3">Preset Stages</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Save commonly used stage names here. They&apos;ll appear as quick-pick options when adding stages to any project.
        </p>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="Stage name (e.g. Quality Check)"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && user && newPresetName.trim()) {
                try {
                  await createPresetStage({ name: newPresetName.trim(), userId: user.uid, createdAt: new Date().toISOString() });
                  setNewPresetName("");
                  toast.success("Preset stage added");
                  load();
                } catch (error: any) { toast.error(error.message || "Failed to add preset stage"); }
              }
            }}
            className="max-w-md"
          />
          <Button
            onClick={async () => {
              if (!user || !newPresetName.trim()) return;
              try {
                await createPresetStage({ name: newPresetName.trim(), userId: user.uid, createdAt: new Date().toISOString() });
                setNewPresetName("");
                toast.success("Preset stage added");
                load();
              } catch (error: any) { toast.error(error.message || "Failed to add preset stage"); }
            }}
            disabled={!newPresetName.trim()}
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>
        {presetStages.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {presetStages.map((ps) => (
              <Badge key={ps.id} variant="secondary" className="text-sm py-1.5 px-3 flex items-center gap-1.5">
                {ps.name}
                <button
                  onClick={async () => {
                    try {
                      await deletePresetStage(ps.id);
                      toast.success("Preset stage removed");
                      load();
                    } catch (error: any) { toast.error(error.message || "Failed to delete preset stage"); }
                  }}
                  className="ml-1 hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No preset stages yet. Add some above!</p>
        )}
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <AuthGate>
      <div className="min-h-[100dvh] flex flex-col">
        <Navbar />
        <TemplatesInner />
      </div>
    </AuthGate>
  );
}
