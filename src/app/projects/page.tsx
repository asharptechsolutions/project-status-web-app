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
  getAssignedProjects, getMembers, getClients, createClient, getClient,
} from "@/lib/data";
import type { Project, ProjectStage, ProjectFile, Template, PresetStage, Member, Client } from "@/lib/types";
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
  Plus, Trash2, ArrowLeft, ChevronRight,
  Pencil, Search, X, ArrowUpDown, Archive, ArchiveRestore,
  Clock, Loader2, GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { FileUpload } from "@/components/file-upload";
import { ProjectChat } from "@/components/project-chat";
import dynamic from "next/dynamic";

const WorkflowCanvas = dynamic(
  () => import("@/components/workflow-canvas").then((m) => m.WorkflowCanvas),
  { ssr: false, loading: () => <div className="h-[400px] flex items-center justify-center border rounded-lg"><Loader2 className="h-6 w-6 animate-spin" /></div> },
);

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
  const [newClientCompany, setNewClientCompany] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [clientMode, setClientMode] = useState<"existing" | "new">("existing");
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [detailClients, setDetailClients] = useState<Client[]>([]);
  // newStageName removed — stages added via canvas toolbar
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active-completed");
  const [sortBy, setSortBy] = useState("newest");
  const [files, setFiles] = useState<ProjectFile[]>([]);
  // Canvas-only view (no list mode)

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const [p, t, ps, m, cl] = await Promise.all([
        isClient && member ? getAssignedProjects(member.id) : getProjects(orgId),
        isAdmin ? getTemplates(orgId) : Promise.resolve([]),
        isAdmin ? getPresetStages(orgId) : Promise.resolve([]),
        getMembers(orgId),
        isAdmin ? getClients(orgId) : Promise.resolve([]),
      ]);
      setProjects(p);
      setTemplates(t);
      setPresetStages(ps);
      setMembers(m);
      setClients(cl);
    } catch (err: any) {
      toast.error(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [orgId, isAdmin, isClient, member]);

  useEffect(() => { load(); }, [load]);

  // Load stages when viewing a project
  useEffect(() => {
    if (!selectedProject) { setStages([]); setFiles([]); setDetailClients([]); return; }
    getProjectStages(selectedProject.id).then(setStages).catch(() => {});
    getProjectFiles(selectedProject.id).then(setFiles).catch(() => {});
    const cids = selectedProject.client_ids?.length ? selectedProject.client_ids : (selectedProject.client_id ? [selectedProject.client_id] : []);
    if (cids.length > 0) {
      Promise.all(cids.map(id => getClient(id).catch(() => null))).then(results => setDetailClients(results.filter(Boolean) as Client[]));
    } else {
      setDetailClients([]);
    }
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
      const allClientIds: string[] = [...selectedClientIds];

      // If user typed a new client but didn't click "Add Client", create it now
      if (clientMode === "new" && newClientName.trim() && newClientEmail.trim()) {
        const newClient = await createClient({
          org_id: orgId,
          name: newClientName.trim(),
          company: newClientCompany.trim() || null,
          email: newClientEmail.trim(),
          phone: newClientPhone.trim() || null,
          created_by: userId,
        });
        allClientIds.push(newClient.id);
        setClients([...clients, newClient]);
      }

      // Send Clerk invitations to all selected clients
      const emailsToInvite = new Set<string>();
      for (const cid of allClientIds) {
        const c = clients.find(cl => cl.id === cid);
        if (c?.email) emailsToInvite.add(c.email);
      }
      for (const email of emailsToInvite) {
        try {
          await fetch("/api/invite-client", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, orgId }),
          });
          toast.success(`Invitation sent to ${email}`);
        } catch {}
      }

      const id = await createProject({
        org_id: orgId,
        name: newName.trim(),
        description: newDescription.trim(),
        client_name: newClientName.trim(),
        client_email: newClientEmail.trim(),
        client_phone: newClientPhone.trim(),
        client_id: allClientIds[0] || null,
        client_ids: allClientIds,
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
      setNewName(""); setNewDescription(""); setNewClientName(""); setNewClientEmail(""); setNewClientPhone(""); setNewClientCompany(""); setSelectedTemplate(""); setSelectedClientIds([]); setClientMode("existing"); setClientSearch(""); setShowNew(false);
      toast.success("Project created");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
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

        {/* Client Info */}
        {(detailClients.length > 0 || selectedProject.client_name) && (
          <Card className="mb-6">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm font-medium mb-1">Client</p>
              <p className="font-medium">
                {detailClients.length > 0 ? detailClients.map((c, i) => (
                  <span key={c.id}>{i > 0 && ", "}{c.name}{c.company && ` (${c.company})`}</span>
                )) : selectedProject.client_name}
              </p>
              <p className="text-sm text-muted-foreground">{detailClients.length > 0 ? detailClients.map(c => c.email).join(", ") : selectedProject.client_email}</p>
              {(detailClients.some(c => c.phone) || selectedProject.client_phone) && (
                <p className="text-sm text-muted-foreground">{detailClients.length > 0 ? detailClients.filter(c => c.phone).map(c => c.phone).join(", ") : selectedProject.client_phone}</p>
              )}
            </CardContent>
          </Card>
        )}

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
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Workflow Stages</h2>
        </div>

        <div className="mb-4">
          {stages.length === 0 && !(isAdmin || isWorker) ? (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">No stages yet.</CardContent></Card>
          ) : (
            <WorkflowCanvas
                stages={stages}
                readOnly={isClient}
                isAdmin={isAdmin}
                isWorker={isWorker}
                onUpdateStatus={updateStageStatus}
                onRemoveStage={removeStage}
                onAddStage={async (name) => {
                  if (!selectedProject) return;
                  try {
                    const stage = await createProjectStage({
                      project_id: selectedProject.id,
                      name,
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
              />
            )}
          </div>
        )

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
              <p className="text-sm font-medium mb-2">Client (optional)</p>
              <div className="flex gap-2 mb-3">
                <Button type="button" variant={clientMode === "existing" ? "default" : "outline"} size="sm" onClick={() => setClientMode("existing")}>Select Existing</Button>
                <Button type="button" variant={clientMode === "new" ? "default" : "outline"} size="sm" onClick={() => setClientMode("new")}>Create New</Button>
              </div>
              {clientMode === "existing" ? (
                <div className="relative">
                  {selectedClientIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {selectedClientIds.map(cid => {
                        const c = clients.find(cl => cl.id === cid);
                        return c ? (
                          <Badge key={cid} variant="secondary" className="gap-1">
                            {c.name}{c.company ? ` (${c.company})` : ""}
                            <button onClick={() => setSelectedClientIds(prev => prev.filter(id => id !== cid))} className="text-muted-foreground hover:text-foreground ml-1"><X className="h-3 w-3" /></button>
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                  <Input
                    placeholder="Search clients to add..."
                    value={clientSearch}
                    onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                    onFocus={() => setShowClientDropdown(true)}
                  />
                  {showClientDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-40 overflow-y-auto">
                      {clients
                        .filter((c) => {
                          if (selectedClientIds.includes(c.id)) return false;
                          const q = clientSearch.toLowerCase();
                          return c.name.toLowerCase().includes(q) || (c.company || "").toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
                        })
                        .map((c) => (
                          <button
                            key={c.id}
                            className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                            onClick={() => {
                              setSelectedClientIds(prev => [...prev, c.id]);
                              setClientSearch("");
                              setShowClientDropdown(false);
                            }}
                          >
                            <span className="font-medium">{c.name}</span>
                            {c.company && <span className="text-muted-foreground"> · {c.company}</span>}
                            <br />
                            <span className="text-xs text-muted-foreground">{c.email}</span>
                          </button>
                        ))}
                      {clients.filter((c) => {
                        if (selectedClientIds.includes(c.id)) return false;
                        const q = clientSearch.toLowerCase();
                        return c.name.toLowerCase().includes(q) || (c.company || "").toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
                      }).length === 0 && (
                        <p className="px-3 py-2 text-sm text-muted-foreground">No clients found</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div><Label>Client Name *</Label><Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="e.g. John Smith" /></div>
                  <div><Label>Company</Label><Input value={newClientCompany} onChange={(e) => setNewClientCompany(e.target.value)} placeholder="e.g. Acme Corp" /></div>
                  <div><Label>Client Email *</Label><Input type="email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="e.g. john@example.com" /></div>
                  <div><Label>Client Phone</Label><Input type="tel" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="e.g. (555) 123-4567" /></div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={!newClientName.trim() || !newClientEmail.trim()}
                    onClick={async () => {
                      if (!orgId || !userId) return;
                      try {
                        const newClient = await createClient({
                          org_id: orgId,
                          name: newClientName.trim(),
                          company: newClientCompany.trim() || null,
                          email: newClientEmail.trim(),
                          phone: newClientPhone.trim() || null,
                          created_by: userId,
                        });
                        setClients(prev => [...prev, newClient]);
                        setSelectedClientIds(prev => [...prev, newClient.id]);
                        setNewClientName("");
                        setNewClientEmail("");
                        setNewClientPhone("");
                        setNewClientCompany("");
                        toast.success(`Client "${newClient.name}" added`);
                      } catch (err: any) {
                        toast.error(err.message || "Failed to create client");
                      }
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Client
                  </Button>
                </div>
              )}
              {/* Show selected clients from both modes */}
              {selectedClientIds.length > 0 && clientMode === "new" && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedClientIds.map(cid => {
                    const c = clients.find(cl => cl.id === cid);
                    return c ? (
                      <Badge key={cid} variant="secondary" className="gap-1">
                        {c.name}{c.company ? ` (${c.company})` : ""}
                        <button onClick={() => setSelectedClientIds(prev => prev.filter(id => id !== cid))} className="text-muted-foreground hover:text-foreground ml-1"><X className="h-3 w-3" /></button>
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
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
