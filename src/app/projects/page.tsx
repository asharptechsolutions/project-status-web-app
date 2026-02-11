"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getProjects, createProject, updateProject, deleteProject, getTemplates, getWorkers } from "@/lib/firestore";
import type { Project, WorkflowNode, WorkflowEdge, WorkflowTemplate, Worker } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft, Play, CheckCircle2, Link2, Copy, ChevronRight } from "lucide-react";
import { nanoid } from "nanoid";
import basePath from "@/lib/base-path";

function ProjectsList() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [copyMsg, setCopyMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const [p, t, w] = await Promise.all([getProjects(user.uid), getTemplates(user.uid), getWorkers(user.uid)]);
    setProjects(p);
    setTemplates(t);
    setWorkers(w);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (searchParams.get("new") === "1") setShowNew(true);
    const id = searchParams.get("id");
    if (id && projects.length) {
      const found = projects.find((p) => p.id === id);
      if (found) setSelectedProject(found);
    }
  }, [searchParams, projects]);

  const handleCreate = async () => {
    if (!user || !newName.trim() || !newClient.trim()) return;
    let nodes: WorkflowNode[] = [];
    let edges: WorkflowEdge[] = [];
    if (selectedTemplate) {
      const tmpl = templates.find((t) => t.id === selectedTemplate);
      if (tmpl) {
        nodes = tmpl.nodes.map((n) => ({ ...n, status: "pending" as const }));
        edges = [...tmpl.edges];
      }
    }
    const id = await createProject({
      name: newName, clientName: newClient, clientEmail: newClientEmail,
      nodes, edges, shareToken: nanoid(12), status: "active",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: user.uid,
    });
    setNewName(""); setNewClient(""); setNewClientEmail(""); setSelectedTemplate(""); setShowNew(false);
    await load();
    const created = (await getProjects(user.uid)).find((p) => p.id === id);
    if (created) setSelectedProject(created);
  };

  const addNode = async () => {
    if (!selectedProject || !newNodeLabel.trim()) return;
    const newNode: WorkflowNode = { id: nanoid(8), label: newNodeLabel, status: "pending" };
    const lastNode = selectedProject.nodes[selectedProject.nodes.length - 1];
    const newEdges = [...selectedProject.edges];
    if (lastNode) newEdges.push({ id: nanoid(8), source: lastNode.id, target: newNode.id });
    const updated = { ...selectedProject, nodes: [...selectedProject.nodes, newNode], edges: newEdges };
    await updateProject(selectedProject.id, { nodes: updated.nodes, edges: updated.edges });
    setSelectedProject(updated);
    setNewNodeLabel("");
    load();
  };

  const updateNodeStatus = async (nodeId: string, status: WorkflowNode["status"]) => {
    if (!selectedProject) return;
    const nodes = selectedProject.nodes.map((n) =>
      n.id === nodeId ? { ...n, status, ...(status === "in-progress" ? { startedAt: new Date().toISOString() } : {}), ...(status === "completed" ? { completedAt: new Date().toISOString() } : {}) } : n
    );
    const allDone = nodes.every((n) => n.status === "completed");
    await updateProject(selectedProject.id, { nodes, status: allDone ? "completed" : "active" });
    setSelectedProject({ ...selectedProject, nodes, status: allDone ? "completed" : "active" });
    load();
  };

  const assignWorker = async (nodeId: string, workerId: string) => {
    if (!selectedProject) return;
    const nodes = selectedProject.nodes.map((n) => n.id === nodeId ? { ...n, assignedTo: workerId || undefined } : n);
    await updateProject(selectedProject.id, { nodes });
    setSelectedProject({ ...selectedProject, nodes });
  };

  const removeNode = async (nodeId: string) => {
    if (!selectedProject) return;
    const nodes = selectedProject.nodes.filter((n) => n.id !== nodeId);
    const edges = selectedProject.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    await updateProject(selectedProject.id, { nodes, edges });
    setSelectedProject({ ...selectedProject, nodes, edges });
    load();
  };

  const copyShareLink = () => {
    if (!selectedProject) return;
    const url = `${window.location.origin}${basePath}/track/?token=${selectedProject.shareToken}`;
    navigator.clipboard.writeText(url);
    setCopyMsg("Copied!");
    setTimeout(() => setCopyMsg(""), 2000);
  };

  const handleDelete = async (id: string) => {
    await deleteProject(id);
    setSelectedProject(null);
    load();
  };

  if (loading) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  if (selectedProject) {
    const progress = selectedProject.nodes.length ? Math.round((selectedProject.nodes.filter((n) => n.status === "completed").length / selectedProject.nodes.length) * 100) : 0;
    return (
      <div className="p-4 max-w-4xl mx-auto w-full">
        <Button variant="ghost" className="mb-4" onClick={() => setSelectedProject(null)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
        </Button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">{selectedProject.name}</h1>
            <p className="text-muted-foreground">Client: {selectedProject.clientName}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={selectedProject.status === "completed" ? "default" : "secondary"}>{selectedProject.status}</Badge>
            <Button variant="outline" size="sm" onClick={copyShareLink}>
              <Link2 className="h-4 w-4 mr-1" /> {copyMsg || "Share Link"}
            </Button>
            <Button variant="destructive" size="sm" onClick={() => handleDelete(selectedProject.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-muted-foreground">{progress}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-3">
            <div className="bg-primary rounded-full h-3 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-3">Workflow Stages</h2>
        <div className="space-y-3 mb-6">
          {selectedProject.nodes.map((node, i) => (
            <Card key={node.id} className={node.status === "completed" ? "border-green-500/50 bg-green-500/5" : node.status === "in-progress" ? "border-blue-500/50 bg-blue-500/5" : ""}>
              <CardContent className="pt-4 pb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm font-medium text-muted-foreground w-6">{i + 1}.</span>
                    <span className="font-medium truncate">{node.label}</span>
                    <Badge variant={node.status === "completed" ? "default" : node.status === "in-progress" ? "secondary" : "outline"} className="shrink-0">
                      {node.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Select value={node.assignedTo || ""} onValueChange={(v) => assignWorker(node.id, v)}>
                      <SelectTrigger className="w-full sm:w-[140px] h-8 text-xs">
                        <SelectValue placeholder="Assign worker" />
                      </SelectTrigger>
                      <SelectContent>
                        {workers.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {node.status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => updateNodeStatus(node.id, "in-progress")}>
                        <Play className="h-3 w-3 mr-1" /> Start
                      </Button>
                    )}
                    {node.status === "in-progress" && (
                      <Button size="sm" onClick={() => updateNodeStatus(node.id, "completed")}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Done
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => removeNode(node.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {i < selectedProject.nodes.length - 1 && (
                  <div className="flex justify-center mt-2"><ChevronRight className="h-4 w-4 text-muted-foreground rotate-90" /></div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-2">
          <Input placeholder="New stage name (e.g. Metal Cutting)" value={newNodeLabel} onChange={(e) => setNewNodeLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNode()} />
          <Button onClick={addNode}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> New Project</Button>
      </div>

      {projects.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No projects yet. Create your first one!</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => {
            const prog = p.nodes.length ? Math.round((p.nodes.filter((n) => n.status === "completed").length / p.nodes.length) * 100) : 0;
            return (
              <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedProject(p)}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-sm text-muted-foreground">Client: {p.clientName} • {p.nodes.length} stages</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.status === "completed" ? "default" : "secondary"}>{prog}%</Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>Create a new workflow project for a client</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Project Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Custom Gear Assembly" /></div>
            <div><Label>Client Name</Label><Input value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="e.g. Acme Corp" /></div>
            <div><Label>Client Email (optional)</Label><Input type="email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="client@example.com" /></div>
            {templates.length > 0 && (
              <div>
                <Label>Template (optional)</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger><SelectValue placeholder="Start from scratch" /></SelectTrigger>
                  <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.nodes.length} stages)</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleCreate} className="w-full" disabled={!newName.trim() || !newClient.trim()}>Create Project</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectsPageInner() {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />
      <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
        <ProjectsList />
      </Suspense>
    </div>
  );
}

export default function ProjectsPage() {
  return <AuthGate><ProjectsPageInner /></AuthGate>;
}
