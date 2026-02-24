"use client";
import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getTemplates, createTemplate, updateTemplate, deleteTemplate, getPresetStages, createPresetStage, deletePresetStage } from "@/lib/data";
import type { Template, PresetStage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Trash2, ChevronRight, Pencil, GripVertical } from "lucide-react";
import { toast } from "sonner";

const SAMPLE_TEMPLATES = [
  { name: "Standard Manufacturing", stages: ["Process Order", "Order Supplies", "Metal Cutting", "Painting Station", "Final Prep", "Shipping"] },
  { name: "CNC Machining", stages: ["Design Review", "Material Prep", "CNC Setup", "Machining", "Quality Check", "Deburring", "Shipping"] },
  { name: "Welding Job", stages: ["Blueprint Review", "Material Cutting", "Tack Welding", "Full Welding", "Grinding", "Inspection", "Delivery"] },
];

function TemplatesInner() {
  const { orgId, userId, isAdmin } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [presetStages, setPresetStages] = useState<PresetStage[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [name, setName] = useState("");
  const [stageNames, setStageNames] = useState<string[]>([]);
  const [newStageName, setNewStageName] = useState("");
  const [newPresetName, setNewPresetName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const [t, ps] = await Promise.all([getTemplates(orgId), getPresetStages(orgId)]);
      setTemplates(t);
      setPresetStages(ps);
    } catch (err: any) {
      toast.error(err.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!orgId || !userId || !name.trim() || stageNames.length === 0) {
      toast.error("Add a name and at least one stage");
      return;
    }
    try {
      await createTemplate({
        team_id: orgId,
        name: name.trim(),
        description: "",
        stages: stageNames.map((s, i) => ({ name: s, position: i })),
        created_by: userId,
      });
      setName(""); setStageNames([]); setShowNew(false);
      toast.success("Template created");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to create template");
    }
  };

  const handleUpdate = async () => {
    if (!editTemplate || !name.trim() || stageNames.length === 0) return;
    try {
      await updateTemplate(editTemplate.id, {
        name: name.trim(),
        stages: stageNames.map((s, i) => ({ name: s, position: i })),
      });
      setShowEdit(false); setEditTemplate(null);
      toast.success("Template updated");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update template");
    }
  };

  const openEdit = (t: Template) => {
    setEditTemplate(t);
    setName(t.name);
    setStageNames(t.stages.map((s) => s.name));
    setShowEdit(true);
  };

  const handleUseSample = async (sample: typeof SAMPLE_TEMPLATES[0]) => {
    if (!orgId || !userId) return;
    try {
      await createTemplate({
        team_id: orgId,
        name: sample.name,
        description: "",
        stages: sample.stages.map((s, i) => ({ name: s, position: i })),
        created_by: userId,
      });
      toast.success("Template added");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to add template");
    }
  };

  const addStageToList = () => {
    if (!newStageName.trim()) return;
    setStageNames([...stageNames, newStageName.trim()]);
    setNewStageName("");
  };

  if (!isAdmin) {
    return (
      <div className="p-4 max-w-7xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-4">Templates</h1>
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Only admins can manage templates.</CardContent></Card>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const StageEditor = () => (
    <div className="space-y-3">
      <div>
        <Label>Template Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Manufacturing" />
      </div>
      <div>
        <Label>Stages</Label>
        <div className="space-y-2 mt-2">
          {stageNames.map((s, i) => (
            <div key={i} className="flex items-center gap-2 bg-secondary/50 rounded px-3 py-2">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-sm">{s}</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setStageNames(stageNames.filter((_, j) => j !== i))}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Input placeholder="Stage name" value={newStageName} onChange={(e) => setNewStageName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addStageToList()} />
          <Button onClick={addStageToList} disabled={!newStageName.trim()} size="sm"><Plus className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-4 max-w-7xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Templates</h1>
        <Button onClick={() => { setName(""); setStageNames([]); setShowNew(true); }}><Plus className="h-4 w-4 mr-1" /> New Template</Button>
      </div>

      {templates.length === 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Quick Start — Sample Templates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {SAMPLE_TEMPLATES.map((s) => (
              <Card key={s.name} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleUseSample(s)}>
                <CardContent className="pt-4 pb-4">
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.stages.length} stages</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {s.stages.map((n, i) => <span key={i} className="text-xs bg-secondary px-1.5 py-0.5 rounded">{n}</span>)}
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
                  {t.stages.map((s, i) => (
                    <span key={i} className="flex items-center text-xs text-muted-foreground">
                      {s.name}{i < t.stages.length - 1 && <ChevronRight className="h-3 w-3 mx-0.5" />}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={async () => { try { await deleteTemplate(t.id); toast.success("Deleted"); load(); } catch (err: any) { toast.error(err.message); } }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Preset Stages */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold mb-3">Preset Stages</h2>
        <p className="text-sm text-muted-foreground mb-4">Quick-pick stage names when building projects.</p>
        <div className="flex gap-2 mb-4">
          <Input placeholder="Stage name (e.g. Quality Check)" value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} onKeyDown={async (e) => {
            if (e.key === "Enter" && orgId && userId && newPresetName.trim()) {
              try { await createPresetStage({ team_id: orgId, name: newPresetName.trim(), created_by: userId }); setNewPresetName(""); toast.success("Added"); load(); } catch (err: any) { toast.error(err.message); }
            }
          }} className="max-w-md" />
          <Button onClick={async () => {
            if (!orgId || !userId || !newPresetName.trim()) return;
            try { await createPresetStage({ team_id: orgId, name: newPresetName.trim(), created_by: userId }); setNewPresetName(""); toast.success("Added"); load(); } catch (err: any) { toast.error(err.message); }
          }} disabled={!newPresetName.trim()}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </div>
        {presetStages.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {presetStages.map((ps) => (
              <Badge key={ps.id} variant="secondary" className="text-sm py-1.5 px-3 flex items-center gap-1.5">
                {ps.name}
                <button onClick={async () => { try { await deletePresetStage(ps.id); toast.success("Removed"); load(); } catch (err: any) { toast.error(err.message); } }} className="ml-1 hover:text-destructive transition-colors">
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No preset stages yet.</p>
        )}
      </div>

      {/* New template dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Template</DialogTitle>
            <DialogDescription>Create a reusable workflow template</DialogDescription>
          </DialogHeader>
          <StageEditor />
          <Button onClick={handleCreate} disabled={!name.trim() || stageNames.length === 0}>Create Template</Button>
        </DialogContent>
      </Dialog>

      {/* Edit template dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
            <DialogDescription>Update template stages</DialogDescription>
          </DialogHeader>
          <StageEditor />
          <Button onClick={handleUpdate} disabled={!name.trim() || stageNames.length === 0}>Save Changes</Button>
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
