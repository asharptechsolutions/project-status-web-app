"use client";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import {
  getProjects, createProject, updateProject, deleteProject,
  getProjectStages, createProjectStage, updateProjectStage, deleteProjectStage,
  getProjectFiles, getProjectMessages, getTemplates, getPresetStages,
  getAssignedProjects, getMembers,
} from "@/lib/data";
import type { Project, ProjectStage, ProjectFile, Template, PresetStage, Member } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Trash2, ArrowLeft, Play, CheckCircle2, ChevronRight,
  Pencil, Search, X, ArrowUpDown, Archive, ArchiveRestore,
  Clock, Loader2, GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { FileUpload } from "@/components/file-upload";
import { ProjectChat } from "@/components/project-chat";

function ProjectsList() {
  const { orgId, userId, isAdmin, isWorker, isClient, member } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const handledParams = useRef(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [presetStages, setPresetStages] = useState<PresetStage[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [newStageName, setNewStageName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active-completed");
  const [sortBy, setSortBy] = useState("newest");
  const [files, setFiles] = useState<ProjectFile[]>([]);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const [p, t, ps, m] = await Promise.all([
        isClient && member ? getAssignedProjects(member.id) : getProjects(orgId),
        isAdmin ? getTemplates(orgId) : Promise.resolve([]),
        isAdmin ? getPresetStages(orgId) : Promise.resolve([]),
        getMembers(orgId),
      ]);
      setProjects(p);
      setTemplates(t);
      setPresetStages(ps);
      setMembers(m);
    } catch (err: any) {
      toast.error(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [orgId, isAdmin, isClient, member]);

  useEffect(() => { load(); }, [load]);

  // Load stages when viewing a project
  useEffect(() => {
    if (!selectedProject) { setStages([]); setFiles([]); return; }
    getProjectStages(selectedProject.id).then(setStages).catch(() => {});
    getProjectFiles(selectedProject.id).then(setFiles).catch(() => {});
    window.scrollTo(0, 0);
  }, [selectedProject?.id]);

  useEffect(() => {
    if (!handledParams.current) {
      if (searchParams.get("new") === "1") {
        setShowNew(true);
        router.replace("/projects/", { scroll: false });
        handledParams.current = true;
        return;
      }
    }
    const id = searchParams.get("id");
    if (id && projects.length) {
      const found = projects.find((p) => p.id === id);
      if (found) setSelectedProject(found);
    }
  }, [searchParams, projects, router]);

  const handleCreate = async () => {
    if (!orgId || !userId) return;
    if (!newName.trim()) { toast.error("Project name is required"); return; }
    try {
      const id = await createProject({
        team_id: orgId,
        name: newName.trim(),
        description: newDescription.trim(),
        client_name: newClientName.trim(),
        client_email: newClientEmail.trim(),
        client_phone: newClientPhone.trim(),
        status: "active",
        created_by: userId,
      });
      // If template selected, create stages from it
      if (selectedTemplate) {
        const tmpl = templates.find((t) => t.id === selectedTemplate);
        if (tmpl?.stages) {
          for (const s of tmpl.stages) {
            await createProjectStage({
              project_id: id,
              name: s.name,
              status: "pending",
              position: s.position,
              started_at: null,
              completed_at: null,
              started_by: null,
            });
          }
        }
      }
      setNewName(""); setNewDescription(""); setNewClientName(""); setNewClientEmail(""); setNewClientPhone(""); setSelectedTemplate(""); setShowNew(false);
      toast.success("Project created");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    }
  };

  const addStage = async () => {
    if (!selectedProject || !newStageName.trim()) return;
    try {
      const stage = await createProjectStage({
        project_id: selectedProject.id,
        name: newStageName.trim(),
        status: "pending",
        position: stages.length,
        started_at: null,
        completed_at: null,
        started_by: null,
      });
      setStages([...stages, stage]);
      setNewStageName("");
    } catch (err: any) {
      toast.error(err.message || "Failed to add stage");
    }
  };

  const updateStageStatus = async (stageId: string, status: ProjectStage["status"]) => {
    if (!selectedProject || !userId) return;
    const now = new Date().toISOString();
    const updates: Partial<ProjectStage> = { status };
    if (status === "in_progress") {
      updates.started_at = now;
      updates.started_by = userId;
    }
    if (status === "completed") {
      updates.completed_at = now;
    }
    try {
      await updateProjectStage(stageId, updates);
      const newStages = stages.map((s) => s.id === stageId ? { ...s, ...updates } : s);
      setStages(newStages);
      // Check if all stages complete
      const allDone = newStages.every((s) => s.status === "completed");
      if (allDone && selectedProject.status !== "completed") {
        await updateProject(selectedProject.id, { status: "completed" });
        setSelectedProject({ ...selectedProject, status: "completed" });
        load();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update stage");
    }
  };

  const removeStage = async (stageId: string) => {
    try {
      await deleteProjectStage(stageId);
      setStages(stages.filter((s) => s.id !== stageId));
    } catch (err: any) {
      toast.error(err.message || "Failed to remove stage");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id);
      setSelectedProject(null);
      toast.success("Project deleted");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete project");
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await updateProject(id, { status: "archived" });
      setSelectedProject(null);
      toast.success("Project archived");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to archive project");
    }
  };

  const handleRestore = async (id: string) => {
    if (!selectedProject) return;
    const allDone = stages.length > 0 && stages.every((s) => s.status === "completed");
    try {
      await updateProject(id, { status: allDone ? "completed" : "active" });
      setSelectedProject({ ...selectedProject, status: allDone ? "completed" : "active" });
      toast.success("Project restored");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to restore project");
    }
  };

  const openEdit = () => {
    if (!selectedProject) return;
    setEditName(selectedProject.name);
    setEditDescription(selectedProject.description || "");
    setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!selectedProject || !editName.trim()) return;
    try {
      await updateProject(selectedProject.id, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      setSelectedProject({ ...selectedProject, name: editName.trim(), description: editDescription.trim() });
      setShowEdit(false);
      toast.success("Project updated");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update project");
    }
  };

  if (loading) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  // Project detail view
  if (selectedProject) {
    const completedCount = stages.filter((s) => s.status === "completed").length;
    const progress = stages.length ? Math.round((completedCount / stages.length) * 100) : 0;

    return (
      <div className="p-4 max-w-4xl mx-auto w-full">
        <Button variant="ghost" className="mb-4" onClick={() => setSelectedProject(null)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
        </Button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">{selectedProject.name}</h1>
            {selectedProject.description && (
              <p className="text-sm text-muted-foreground mt-1">{selectedProject.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={selectedProject.status === "completed" ? "default" : "secondary"}>
              {selectedProject.status}
            </Badge>
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" onClick={openEdit}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
                {selectedProject.status === "archived" ? (
                  <Button variant="outline" size="sm" onClick={() => handleRestore(selectedProject.id)}>
                    <ArchiveRestore className="h-4 w-4 mr-1" /> Restore
                  </Button>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Archive className="h-4 w-4 mr-1" /> Archive
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Archive Project</AlertDialogTitle>
                        <AlertDialogDescription>
                          Archive &quot;{selectedProject.name}&quot;? It will be hidden from the default view.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleArchive(selectedProject.id)}>Archive</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Project</AlertDialogTitle>
                      <AlertDialogDescription>
                        Permanently delete &quot;{selectedProject.name}&quot;? This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(selectedProject.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">Progress</span>
            <span className="text-sm text-muted-foreground">{progress}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-3">
            <div className="bg-primary rounded-full h-3 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Stages */}
        <h2 className="text-lg font-semibold mb-3">Workflow Stages</h2>
        <div className="space-y-3 mb-4">
          {stages.length === 0 ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">No stages yet. {isAdmin || isWorker ? "Add your first one below!" : ""}</CardContent></Card>
          ) : (
            stages.map((stage) => (
              <Card key={stage.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {stage.status === "completed" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                        {stage.status === "in_progress" && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
                        {stage.status === "pending" && <Clock className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div>
                        <p className="font-medium">{stage.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {stage.status === "completed" && stage.completed_at && `Completed ${new Date(stage.completed_at).toLocaleDateString()}`}
                          {stage.status === "in_progress" && stage.started_at && `Started ${new Date(stage.started_at).toLocaleDateString()}`}
                          {stage.status === "pending" && "Pending"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {(isAdmin || isWorker) && stage.status === "pending" && (
                        <Button size="sm" variant="outline" onClick={() => updateStageStatus(stage.id, "in_progress")}>
                          <Play className="h-3 w-3 mr-1" /> Start
                        </Button>
                      )}
                      {(isAdmin || isWorker) && stage.status === "in_progress" && (
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => updateStageStatus(stage.id, "completed")}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Complete
                        </Button>
                      )}
                      {isAdmin && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeStage(stage.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Add stage */}
        {(isAdmin || isWorker) && (
          <div className="flex gap-2 mb-8">
            <Input
              placeholder="New stage name (e.g. Metal Cutting)"
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addStage()}
            />
            <Button onClick={addStage} disabled={!newStageName.trim()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        )}

        {/* Preset stages quick-add */}
        {(isAdmin || isWorker) && presetStages.length > 0 && (
          <div className="mb-8">
            <p className="text-sm text-muted-foreground mb-2">Quick add preset stages:</p>
            <div className="flex flex-wrap gap-2">
              {presetStages.map((ps) => (
                <Button
                  key={ps.id}
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    try {
                      const stage = await createProjectStage({
                        project_id: selectedProject.id,
                        name: ps.name,
                        status: "pending",
                        position: stages.length,
                        started_at: null,
                        completed_at: null,
                        started_by: null,
                      });
                      setStages([...stages, stage]);
                    } catch (err: any) {
                      toast.error(err.message || "Failed to add stage");
                    }
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" /> {ps.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Files */}
        <div className="mt-8">
          <FileUpload
            projectId={selectedProject.id}
            files={files}
            onFilesChange={setFiles}
            readOnly={isClient}
            canDelete={isAdmin}
          />
        </div>

        {/* Chat */}
        <div className="mt-8">
          <ProjectChat projectId={selectedProject.id} />
        </div>

        {/* Edit dialog */}
        <Dialog open={showEdit} onOpenChange={setShowEdit}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
              <DialogDescription>Update project details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Project Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
              <div><Label>Description (optional)</Label><Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} /></div>
              <Button onClick={handleEdit} className="w-full" disabled={!editName.trim()}>Save Changes</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Project list view
  const filteredProjects = projects
    .filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" ? true : statusFilter === "active-completed" ? p.status !== "archived" : p.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest": return (b.created_at || "").localeCompare(a.created_at || "");
        case "oldest": return (a.created_at || "").localeCompare(b.created_at || "");
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        default: return 0;
      }
    });

  return (
    <div className="p-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        {isAdmin && (
          <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> New Project</Button>
        )}
      </div>

      {projects.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-8" />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active-completed">Active & Completed</SelectItem>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <ArrowUpDown className="h-4 w-4 mr-2" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="name-asc">Name A–Z</SelectItem>
              <SelectItem value="name-desc">Name Z–A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {filteredProjects.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          {projects.length === 0 ? (isAdmin ? "No projects yet. Create your first one!" : "No projects assigned to you.") : "No projects match your search."}
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredProjects.map((p) => (
            <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedProject(p)}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    {p.description && <p className="text-sm text-muted-foreground line-clamp-1">{p.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      Created {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.status === "archived" ? (
                      <Badge variant="outline"><Archive className="h-3 w-3 mr-1" />Archived</Badge>
                    ) : (
                      <Badge variant={p.status === "completed" ? "default" : "secondary"}>{p.status}</Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New project dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>Create a new workflow project</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Project Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Custom Gear Assembly" /></div>
            <div><Label>Description (optional)</Label><Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Brief description" rows={2} /></div>
            <div className="border-t pt-3 mt-1">
              <p className="text-sm font-medium mb-2">Client Info (optional)</p>
              <div className="space-y-3">
                <div><Label>Client Name</Label><Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="e.g. John Smith" /></div>
                <div><Label>Client Email</Label><Input type="email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="e.g. john@example.com" /></div>
                <div><Label>Client Phone</Label><Input type="tel" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="e.g. (555) 123-4567" /></div>
              </div>
            </div>
            {templates.length > 0 && (
              <div>
                <Label>Template (optional)</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger><SelectValue placeholder="Start from scratch" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name} ({t.stages.length} stages)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleCreate} className="w-full" disabled={!newName.trim()}>Create Project</Button>
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
