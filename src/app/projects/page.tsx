"use client";
import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getProjects, createProject, updateProject, deleteProject, getTemplates, getWorkers, onProjectFiles, getPresetStages, onAllMessages, onAllFiles } from "@/lib/firestore";
import type { Project, ProjectContact, WorkflowNode, WorkflowEdge, WorkflowTemplate, Worker, ProjectFile, PresetStage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ArrowLeft, Play, CheckCircle2, Link2, Copy, ChevronRight, Pencil, Search, X, ArrowUpDown, Archive, ArchiveRestore, Bell, BellOff, Users, UserPlus, MessageCircle, FileText } from "lucide-react";
import { nanoid } from "nanoid";
import basePath from "@/lib/base-path";
import { toast } from "sonner";
import { WorkflowCanvas } from "@/components/workflow-canvas";
import { FileUpload } from "@/components/file-upload";
import { ProjectChat } from "@/components/project-chat";
import { notifyStageChange } from "@/lib/notifications";

function ProjectsList() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const handledParams = useRef(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [presetStages, setPresetStages] = useState<PresetStage[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClient, setNewClient] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [copyMsg, setCopyMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editClient, setEditClient] = useState("");
  const [editClientEmail, setEditClientEmail] = useState("");
  const [editClientPhone, setEditClientPhone] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active-completed");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [projectFiles, setProjectFiles] = useState<ProjectFile[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [showListEdit, setShowListEdit] = useState(false);
  const [listEditName, setListEditName] = useState("");
  const [listEditClient, setListEditClient] = useState("");
  const [listEditClientEmail, setListEditClientEmail] = useState("");
  const [listEditClientPhone, setListEditClientPhone] = useState("");
  const [listEditDescription, setListEditDescription] = useState("");
  const [latestMessages, setLatestMessages] = useState<Record<string, { count: number; latestAt: string; fromClient: boolean }>>({});
  const [latestFiles, setLatestFiles] = useState<Record<string, { latestAt: string }>>({});

  // Get last-seen timestamps from localStorage
  const getLastSeen = (projectId: string): string => {
    try { return localStorage.getItem(`ps_seen_${projectId}`) || ""; } catch { return ""; }
  };
  const markSeen = (projectId: string) => {
    try { localStorage.setItem(`ps_seen_${projectId}`, new Date().toISOString()); } catch {}
  };

  const hasUnreadMessages = (projectId: string) => {
    const msg = latestMessages[projectId];
    if (!msg) return false;
    const seen = getLastSeen(projectId);
    return msg.latestAt > seen;
  };

  const hasUnseenFiles = (projectId: string) => {
    const file = latestFiles[projectId];
    if (!file) return false;
    const seen = getLastSeen(projectId);
    return file.latestAt > seen;
  };

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [p, t, w, ps] = await Promise.all([getProjects(user.uid), getTemplates(user.uid), getWorkers(user.uid), getPresetStages(user.uid)]);
      setProjects(p);
      setTemplates(t);
      setWorkers(w);
      setPresetStages(ps);
    } catch (error: any) {
      toast.error(error.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Real-time unread tracking across all projects
  useEffect(() => {
    const ids = projects.map((p) => p.id);
    if (!ids.length) return;
    const unsub1 = onAllMessages(ids, setLatestMessages);
    const unsub2 = onAllFiles(ids, setLatestFiles);
    return () => { unsub1(); unsub2(); };
  }, [projects]);

  // Scroll to top when project detail opens
  useEffect(() => {
    if (selectedProject) window.scrollTo(0, 0);
  }, [selectedProject?.id]);

  useEffect(() => {
    if (selectedProject) {
      const unsub = onProjectFiles(selectedProject.id, setProjectFiles);
      return unsub;
    } else {
      setProjectFiles([]);
    }
  }, [selectedProject?.id]);

  useEffect(() => {
    if (!handledParams.current) {
      if (searchParams.get("new") === "1") {
        setShowNew(true);
        // Clear ?new=1 from URL to prevent re-triggering on refresh
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
    if (!user) { toast.error("Not logged in"); return; }
    if (!newName.trim()) { toast.error("Project name is required"); return; }
    let nodes: WorkflowNode[] = [];
    let edges: WorkflowEdge[] = [];
    if (selectedTemplate) {
      const tmpl = templates.find((t) => t.id === selectedTemplate);
      if (tmpl) {
        nodes = tmpl.nodes.map((n) => ({ ...n, status: "pending" as const }));
        edges = [...tmpl.edges];
      }
    }
    // Auto-create initial "Order Planning" source node if no template selected
    if (nodes.length === 0) {
      nodes = [{ id: nanoid(8), label: "Order Planning", status: "pending", position: { x: 250, y: 50 } }];
    }
    try {
      const initialContacts: ProjectContact[] = newClientEmail.trim()
        ? newClientEmail.split(",").map(e => e.trim()).filter(e => e).map(email => ({ name: newClient.trim(), email: email.toLowerCase() }))
        : [];
      const primaryEmail = initialContacts.length > 0 ? initialContacts[0].email : "";
      const id = await createProject({
        name: newName, clientName: newClient, clientEmail: primaryEmail, clientPhone: newClientPhone.trim() || undefined,
        description: newDescription.trim() || undefined,
        nodes, edges, contacts: initialContacts, shareToken: nanoid(12), status: "active",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), userId: user.uid,
      });
      setNewName(""); setNewClient(""); setNewClientEmail(""); setNewClientPhone(""); setNewDescription(""); setSelectedTemplate(""); setShowNew(false);
      toast.success("Project created");
      await load();
      const created = (await getProjects(user.uid)).find((p) => p.id === id);
      if (created) setSelectedProject(created);
    } catch (error: any) {
      toast.error(error.message || "Failed to create project");
    }
  };

  const addNodeAtPosition = async (label: string, position: { x: number; y: number }) => {
    if (!selectedProject) return;
    const newNode: WorkflowNode = { id: nanoid(8), label, status: "pending", position };
    const updated = { ...selectedProject, nodes: [...selectedProject.nodes, newNode] };
    try {
      await updateProject(selectedProject.id, { nodes: updated.nodes });
      setSelectedProject(updated);
      load();
    } catch (error: any) {
      toast.error(error.message || "Failed to add stage");
    }
  };

  const addNode = async () => {
    if (!selectedProject || !newNodeLabel.trim()) return;
    const newNode: WorkflowNode = { id: nanoid(8), label: newNodeLabel, status: "pending" };
    const lastNode = selectedProject.nodes[selectedProject.nodes.length - 1];
    const newEdges = [...selectedProject.edges];
    if (lastNode) newEdges.push({ id: nanoid(8), source: lastNode.id, target: newNode.id });
    const updated = { ...selectedProject, nodes: [...selectedProject.nodes, newNode], edges: newEdges };
    try {
      await updateProject(selectedProject.id, { nodes: updated.nodes, edges: updated.edges });
      setSelectedProject(updated);
      setNewNodeLabel("");
      load();
    } catch (error: any) {
      toast.error(error.message || "Failed to add stage");
    }
  };

  const updateNodeStatus = async (nodeId: string, status: WorkflowNode["status"]) => {
    if (!selectedProject) return;
    // Parallel workflow validation: check all predecessors are completed before starting
    if (status === "in-progress") {
      const incomingEdges = selectedProject.edges.filter((e) => e.target === nodeId);
      const incomplete = incomingEdges
        .map((e) => selectedProject.nodes.find((n) => n.id === e.source))
        .filter((n) => n && n.status !== "completed");
      if (incomplete.length > 0) {
        toast.error(`Cannot start: waiting on ${incomplete.map((n) => n!.label).join(", ")}`);
        return;
      }
    }
    const nodes = selectedProject.nodes.map((n) =>
      n.id === nodeId ? { ...n, status, ...(status === "in-progress" ? { startedAt: new Date().toISOString() } : {}), ...(status === "completed" ? { completedAt: new Date().toISOString() } : {}) } : n
    );
    const allDone = nodes.every((n) => n.status === "completed");
    try {
      await updateProject(selectedProject.id, { nodes, status: allDone ? "completed" : "active" });
      setSelectedProject({ ...selectedProject, nodes, status: allDone ? "completed" : "active" });
      // Send email notification to client if they have an email
      const changedNode = nodes.find((n) => n.id === nodeId);
      if (changedNode) {
        notifyStageChange(selectedProject, changedNode, status, allDone);
      }
      load();
    } catch (error: any) {
      toast.error(error.message || "Failed to update stage");
    }
  };

  const assignWorker = async (nodeId: string, workerId: string) => {
    if (!selectedProject) return;
    const nodes = selectedProject.nodes.map((n) => n.id === nodeId ? { ...n, assignedTo: workerId || undefined } : n);
    try {
      await updateProject(selectedProject.id, { nodes });
      setSelectedProject({ ...selectedProject, nodes });
    } catch (error: any) {
      toast.error(error.message || "Failed to assign worker");
    }
  };

  const updateEstimatedCompletion = async (nodeId: string, date: string) => {
    if (!selectedProject) return;
    const nodes = selectedProject.nodes.map((n) => n.id === nodeId ? { ...n, estimatedCompletion: date || undefined } : n);
    try {
      await updateProject(selectedProject.id, { nodes });
      setSelectedProject({ ...selectedProject, nodes });
    } catch (error: any) {
      toast.error(error.message || "Failed to update estimated completion");
    }
  };

  const renameNode = async (nodeId: string, label: string) => {
    if (!selectedProject) return;
    const nodes = selectedProject.nodes.map((n) => n.id === nodeId ? { ...n, label } : n);
    try {
      await updateProject(selectedProject.id, { nodes });
      setSelectedProject({ ...selectedProject, nodes });
    } catch (error: any) {
      toast.error(error.message || "Failed to rename stage");
    }
  };

  const removeNode = async (nodeId: string) => {
    if (!selectedProject) return;
    const nodes = selectedProject.nodes.filter((n) => n.id !== nodeId);
    const edges = selectedProject.edges.filter((e) => e.source !== nodeId && e.target !== nodeId);
    try {
      await updateProject(selectedProject.id, { nodes, edges });
      setSelectedProject({ ...selectedProject, nodes, edges });
      load();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove stage");
    }
  };

  const copyShareLink = () => {
    if (!selectedProject) return;
    const url = `${window.location.origin}${basePath}/track/?id=${selectedProject.id}&token=${selectedProject.shareToken}`;
    navigator.clipboard.writeText(url);
    setCopyMsg("Copied!");
    setTimeout(() => setCopyMsg(""), 2000);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id);
      setSelectedProject(null);
      toast.success("Project deleted");
      load();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete project");
    }
  };

  const handleArchive = async (id: string) => {
    try {
      await updateProject(id, { status: "archived" });
      setSelectedProject(null);
      toast.success("Project archived");
      load();
    } catch (error: any) {
      toast.error(error.message || "Failed to archive project");
    }
  };

  const handleRestore = async (id: string) => {
    if (!selectedProject) return;
    const allDone = selectedProject.nodes.length > 0 && selectedProject.nodes.every((n) => n.status === "completed");
    try {
      await updateProject(id, { status: allDone ? "completed" : "active" });
      setSelectedProject({ ...selectedProject, status: allDone ? "completed" : "active" });
      toast.success("Project restored");
      load();
    } catch (error: any) {
      toast.error(error.message || "Failed to restore project");
    }
  };

  const openEdit = () => {
    if (!selectedProject) return;
    setEditName(selectedProject.name);
    setEditClient(selectedProject.clientName);
    setEditClientEmail(selectedProject.clientEmail || "");
    setEditClientPhone(selectedProject.clientPhone || "");
    setEditDescription(selectedProject.description || "");
    setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!selectedProject || !editName.trim() || !editClient.trim()) return;
    try {
      await updateProject(selectedProject.id, {
        name: editName.trim(),
        clientName: editClient.trim(),
        clientEmail: editClientEmail.trim(),
        clientPhone: editClientPhone.trim() || undefined,
        description: editDescription.trim() || undefined,
        updatedAt: new Date().toISOString(),
      });
      setSelectedProject({ ...selectedProject, name: editName.trim(), clientName: editClient.trim(), clientEmail: editClientEmail.trim(), clientPhone: editClientPhone.trim() || undefined, description: editDescription.trim() || undefined });
      setShowEdit(false);
      toast.success("Project updated");
      load();
    } catch (error: any) {
      toast.error(error.message || "Failed to update project");
    }
  };

  const addContact = async () => {
    if (!selectedProject || !newContactName.trim() || !newContactEmail.trim()) return;
    const contacts = [...(selectedProject.contacts || []), { name: newContactName.trim(), email: newContactEmail.trim().toLowerCase() }];
    try {
      await updateProject(selectedProject.id, { contacts });
      setSelectedProject({ ...selectedProject, contacts });
      setNewContactName("");
      setNewContactEmail("");
      toast.success("Contact added");
      load();
    } catch (error: any) {
      toast.error(error.message || "Failed to add contact");
    }
  };

  const removeContact = async (email: string) => {
    if (!selectedProject) return;
    const contacts = (selectedProject.contacts || []).filter((c) => c.email !== email);
    try {
      await updateProject(selectedProject.id, { contacts });
      setSelectedProject({ ...selectedProject, contacts });
      toast.success("Contact removed");
      load();
    } catch (error: any) {
      toast.error(error.message || "Failed to remove contact");
    }
  };

  const openListEdit = (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProject(p);
    setListEditName(p.name);
    setListEditClient(p.clientName);
    setListEditClientEmail(p.clientEmail || "");
    setListEditClientPhone(p.clientPhone || "");
    setListEditDescription(p.description || "");
    setShowListEdit(true);
  };

  const handleListEdit = async () => {
    if (!editingProject || !listEditName.trim()) return;
    try {
      await updateProject(editingProject.id, {
        name: listEditName.trim(),
        clientName: listEditClient.trim(),
        clientEmail: listEditClientEmail.trim(),
        clientPhone: listEditClientPhone.trim() || undefined,
        description: listEditDescription.trim() || undefined,
        updatedAt: new Date().toISOString(),
      });
      setShowListEdit(false);
      setEditingProject(null);
      toast.success("Project updated");
      load();
    } catch (error: any) {
      toast.error(error.message || "Failed to update project");
    }
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
            <p className="text-muted-foreground flex items-center gap-2">
              Client: {selectedProject.clientName}
              {selectedProject.clientEmail ? (
                <span className="inline-flex items-center gap-1 text-xs text-green-600 dark:text-green-400" title={`Notifications → ${selectedProject.clientEmail}`}>
                  <Bell className="h-3 w-3" /> Email alerts on
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Add client email to enable notifications">
                  <BellOff className="h-3 w-3" /> No email set
                </span>
              )}
              {selectedProject.clientPhone && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  📞 {selectedProject.clientPhone}
                </span>
              )}
            </p>
            {selectedProject.description && <p className="text-sm text-muted-foreground mt-1">{selectedProject.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={selectedProject.status === "completed" ? "default" : "secondary"}>{selectedProject.status}</Badge>
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={copyShareLink}>
              <Link2 className="h-4 w-4 mr-1" /> {copyMsg || "Share Link"}
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
                      Archive &quot;{selectedProject.name}&quot;? It will be hidden from the default view but can be restored anytime.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleArchive(selectedProject.id)}>
                      Archive
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Project</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to permanently delete &quot;{selectedProject.name}&quot;? This action cannot be undone. Consider archiving instead.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(selectedProject.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete Forever
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
        <div className="mb-6">
          {selectedProject.nodes.length > 0 ? (
            <WorkflowCanvas
              nodes={selectedProject.nodes}
              edges={selectedProject.edges}
              workers={workers}
              onNodesUpdate={async (nodes) => {
                try {
                  await updateProject(selectedProject.id, { nodes });
                  setSelectedProject({ ...selectedProject, nodes });
                } catch (error: any) {
                  toast.error(error.message || "Failed to save positions");
                }
              }}
              onEdgesUpdate={async (edges) => {
                try {
                  await updateProject(selectedProject.id, { edges });
                  setSelectedProject({ ...selectedProject, edges });
                } catch (error: any) {
                  toast.error(error.message || "Failed to save edges");
                }
              }}
              onStatusChange={updateNodeStatus}
              onAssignWorker={assignWorker}
              onRemoveNode={removeNode}
              onRenameNode={renameNode}
              onEstimatedCompletionChange={updateEstimatedCompletion}
              onAddNode={addNodeAtPosition}
              presetStages={presetStages}
            />
          ) : (
            <Card><CardContent className="pt-6 text-center text-muted-foreground">No stages yet. Add your first one below!</CardContent></Card>
          )}
        </div>

        <div className="flex gap-2">
          <Input placeholder="New stage name (e.g. Metal Cutting)" value={newNodeLabel} onChange={(e) => setNewNodeLabel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNode()} />
          <Button onClick={addNode}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="h-5 w-5" /> Contacts
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Only contacts listed here can view this project via the tracking link. They&apos;ll verify their email with a code.
          </p>
          {(selectedProject.contacts || []).length > 0 && (
            <div className="space-y-2 mb-4">
              {(selectedProject.contacts || []).map((c) => (
                <div key={c.email} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
                  <div>
                    <span className="font-medium text-sm">{c.name}</span>
                    <span className="text-sm text-muted-foreground ml-2">{c.email}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeContact(c.email)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <Input placeholder="Name" value={newContactName} onChange={(e) => setNewContactName(e.target.value)} className="sm:w-1/3" />
            <Input placeholder="Email" type="email" value={newContactEmail} onChange={(e) => setNewContactEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addContact()} className="sm:flex-1" />
            <Button onClick={addContact} disabled={!newContactName.trim() || !newContactEmail.trim()}>
              <UserPlus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </div>

        <div className="mt-8">
          <FileUpload
            projectId={selectedProject.id}
            uploaderEmail={user?.email || "manager"}
            files={projectFiles}
            onFilesChange={setProjectFiles}
            readOnly
            canDelete
          />
        </div>

        <div className="mt-8">
          <ProjectChat
            projectId={selectedProject.id}
            senderEmail={user?.email || "manager"}
            senderName="Project Manager"
            senderRole="manager"
          />
        </div>

        <Dialog open={showEdit} onOpenChange={setShowEdit}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
              <DialogDescription>Update project name and client information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Project Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
              <div><Label>Client Name</Label><Input value={editClient} onChange={(e) => setEditClient(e.target.value)} /></div>
              <div><Label>Approved Contacts (optional)</Label><Input value={editClientEmail} onChange={(e) => setEditClientEmail(e.target.value)} placeholder="email1@example.com, email2@example.com" /><p className="text-xs text-muted-foreground mt-1">Comma-separated emails</p></div>
              <div><Label>Client Phone (optional)</Label><Input type="tel" value={editClientPhone} onChange={(e) => setEditClientPhone(e.target.value)} /></div>
              <div><Label>Description (optional)</Label><Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Brief description of the project scope and goals" rows={3} /></div>
              <Button onClick={handleEdit} className="w-full" disabled={!editName.trim() || !editClient.trim()}>Save Changes</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  const filteredProjects = projects.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q);
    const matchesStatus = statusFilter === "all" ? true : statusFilter === "active-completed" ? p.status !== "archived" : p.status === statusFilter;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    switch (sortBy) {
      case "newest": return (b.createdAt || "").localeCompare(a.createdAt || "");
      case "oldest": return (a.createdAt || "").localeCompare(b.createdAt || "");
      case "name-asc": return a.name.localeCompare(b.name);
      case "name-desc": return b.name.localeCompare(a.name);
      case "client": return a.clientName.localeCompare(b.clientName);
      case "progress": {
        const progA = a.nodes.length ? a.nodes.filter(n => n.status === "completed").length / a.nodes.length : 0;
        const progB = b.nodes.length ? b.nodes.filter(n => n.status === "completed").length / b.nodes.length : 0;
        return progB - progA;
      }
      default: return 0;
    }
  });

  return (
    <div className="p-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> New Project</Button>
      </div>

      {projects.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects or clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active-completed">Active & Completed</SelectItem>
              <SelectItem value="all">All (incl. Archived)</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="name-asc">Name A–Z</SelectItem>
              <SelectItem value="name-desc">Name Z–A</SelectItem>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="progress">Progress</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {projects.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No projects yet. Create your first one!</CardContent></Card>
      ) : filteredProjects.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No projects match your search.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredProjects.map((p) => {
            const prog = p.nodes.length ? Math.round((p.nodes.filter((n) => n.status === "completed").length / p.nodes.length) * 100) : 0;
            return (
              <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { markSeen(p.id); setSelectedProject(p); }}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-sm text-muted-foreground">Client: {p.clientName} • {p.nodes.length} stages</p>
                      {p.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.description}</p>}
                      {(hasUnreadMessages(p.id) || hasUnseenFiles(p.id)) && (
                        <div className="flex items-center gap-2 mt-1">
                          {hasUnreadMessages(p.id) && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                              <MessageCircle className="h-3 w-3" />New message
                            </span>
                          )}
                          {hasUnseenFiles(p.id) && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                              <FileText className="h-3 w-3" />New file
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => openListEdit(p, e)} title="Edit project">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {p.status === "archived" ? (
                        <Badge variant="outline"><Archive className="h-3 w-3 mr-1" />Archived</Badge>
                      ) : (
                        <Badge variant={p.status === "completed" ? "default" : "secondary"}>{prog}%</Badge>
                      )}
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
            <div><Label>Client Name (optional)</Label><Input value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="e.g. Acme Corp" /></div>
            <div><Label>Approved Contacts (optional)</Label><Input value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="email1@example.com, email2@example.com" /><p className="text-xs text-muted-foreground mt-1">Comma-separated emails — auto-added to approved contacts</p></div>
            <div><Label>Client Phone (optional)</Label><Input type="tel" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="(555) 123-4567" /></div>
            <div><Label>Description (optional)</Label><Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Brief description of the project scope and goals" rows={3} /></div>
            {templates.length > 0 && (
              <div>
                <Label>Template (optional)</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger><SelectValue placeholder="Start from scratch" /></SelectTrigger>
                  <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.nodes.length} stages)</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleCreate} className="w-full" disabled={!newName.trim()}>Create Project</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showListEdit} onOpenChange={setShowListEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update project name and client information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Project Name</Label><Input value={listEditName} onChange={(e) => setListEditName(e.target.value)} /></div>
            <div><Label>Client Name</Label><Input value={listEditClient} onChange={(e) => setListEditClient(e.target.value)} /></div>
            <div><Label>Client Email (optional)</Label><Input value={listEditClientEmail} onChange={(e) => setListEditClientEmail(e.target.value)} placeholder="email@example.com" /></div>
            <div><Label>Client Phone (optional)</Label><Input type="tel" value={listEditClientPhone} onChange={(e) => setListEditClientPhone(e.target.value)} /></div>
            <div><Label>Description (optional)</Label><Textarea value={listEditDescription} onChange={(e) => setListEditDescription(e.target.value)} placeholder="Brief description of the project scope and goals" rows={3} /></div>
            <Button onClick={handleListEdit} className="w-full" disabled={!listEditName.trim()}>Save Changes</Button>
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
