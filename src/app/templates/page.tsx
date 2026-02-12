"use client";
import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from "@/lib/firestore";
import type { WorkflowTemplate, WorkflowNode, WorkflowEdge } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronRight, Pencil } from "lucide-react";
import { nanoid } from "nanoid";
import { toast } from "sonner";

const SAMPLE_TEMPLATES = [
  { name: "Standard Manufacturing", nodes: ["Process Order", "Order Supplies", "Metal Cutting", "Painting Station", "Final Prep", "Shipping"] },
  { name: "CNC Machining", nodes: ["Design Review", "Material Prep", "CNC Setup", "Machining", "Quality Check", "Deburring", "Shipping"] },
  { name: "Welding Job", nodes: ["Blueprint Review", "Material Cutting", "Tack Welding", "Full Welding", "Grinding", "Inspection", "Delivery"] },
];

function TemplatesInner() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null);
  const [name, setName] = useState("");
  const [stages, setStages] = useState<string[]>([""]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try { setTemplates(await getTemplates(user.uid)); } catch (error: any) { toast.error(error.message || "Failed to load templates"); } finally { setLoading(false); }
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    const validStages = stages.filter((s) => s.trim());
    if (!validStages.length) return;
    const nodes: Omit<WorkflowNode, "status" | "startedAt" | "completedAt">[] = validStages.map((s) => ({ id: nanoid(8), label: s }));
    const edges: WorkflowEdge[] = nodes.slice(0, -1).map((n, i) => ({ id: nanoid(8), source: n.id, target: nodes[i + 1].id }));
    try {
      await createTemplate({ name, description: "", nodes, edges, userId: user.uid, createdAt: new Date().toISOString() });
      setName(""); setStages([""]); setShowNew(false); toast.success("Template created"); load();
    } catch (error: any) { toast.error(error.message || "Failed to create template"); }
  };

  const handleUseSample = async (sample: typeof SAMPLE_TEMPLATES[0]) => {
    if (!user) return;
    const nodes: Omit<WorkflowNode, "status" | "startedAt" | "completedAt">[] = sample.nodes.map((s) => ({ id: nanoid(8), label: s }));
    const edges: WorkflowEdge[] = nodes.slice(0, -1).map((n, i) => ({ id: nanoid(8), source: n.id, target: nodes[i + 1].id }));
    try {
      await createTemplate({ name: sample.name, description: "", nodes, edges, userId: user.uid, createdAt: new Date().toISOString() });
      toast.success("Template added"); load();
    } catch (error: any) { toast.error(error.message || "Failed to add template"); }
  };

  const openEdit = (t: WorkflowTemplate) => {
    setEditingTemplate(t);
    setName(t.name);
    setStages(t.nodes.map((n) => n.label));
  };

  const handleUpdate = async () => {
    if (!editingTemplate || !name.trim()) return;
    const validStages = stages.filter((s) => s.trim());
    if (!validStages.length) return;
    // Reuse existing node ids where possible, generate new ones for added stages
    const nodes: Omit<WorkflowNode, "status" | "startedAt" | "completedAt">[] = validStages.map((s, i) => ({
      id: editingTemplate.nodes[i]?.id || nanoid(8),
      label: s,
    }));
    const edges: WorkflowEdge[] = nodes.slice(0, -1).map((n, i) => ({
      id: nanoid(8),
      source: n.id,
      target: nodes[i + 1].id,
    }));
    try {
      await updateTemplate(editingTemplate.id, { name, nodes, edges });
      setEditingTemplate(null); setName(""); setStages([""]); toast.success("Template updated"); load();
    } catch (error: any) { toast.error(error.message || "Failed to update template"); }
  };

  if (loading) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="p-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Templates</h1>
        <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> New Template</Button>
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

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Template</DialogTitle>
            <DialogDescription>Create a reusable workflow template</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Template Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Manufacturing" /></div>
            <div>
              <Label>Stages</Label>
              <div className="space-y-2 mt-1">
                {stages.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={s} onChange={(e) => { const c = [...stages]; c[i] = e.target.value; setStages(c); }} placeholder={`Stage ${i + 1}`} />
                    {stages.length > 1 && <Button variant="ghost" size="icon" onClick={() => setStages(stages.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setStages([...stages, ""])}><Plus className="h-3 w-3 mr-1" /> Add Stage</Button>
              </div>
            </div>
            <Button onClick={handleCreate} className="w-full" disabled={!name.trim()}>Create Template</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTemplate} onOpenChange={(open) => { if (!open) { setEditingTemplate(null); setName(""); setStages([""]); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>Update template name and stages</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Template Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Manufacturing" /></div>
            <div>
              <Label>Stages</Label>
              <div className="space-y-2 mt-1">
                {stages.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={s} onChange={(e) => { const c = [...stages]; c[i] = e.target.value; setStages(c); }} placeholder={`Stage ${i + 1}`} />
                    {stages.length > 1 && <Button variant="ghost" size="icon" onClick={() => setStages(stages.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setStages([...stages, ""])}><Plus className="h-3 w-3 mr-1" /> Add Stage</Button>
              </div>
            </div>
            <Button onClick={handleUpdate} className="w-full" disabled={!name.trim()}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
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
