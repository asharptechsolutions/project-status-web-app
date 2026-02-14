"use client";
import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getWorkers, createWorker, updateWorker, deleteWorker, getWorkerProjects } from "@/lib/data";
import type { Worker, Project } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Search, X, Pencil, Trash2, ArrowLeft, Mail, Phone, FolderOpen, Briefcase } from "lucide-react";
import { toast } from "sonner";

function WorkersInner() {
  const { orgId, userId, isAdmin } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null);
  const [workerProjects, setWorkerProjects] = useState<Project[]>([]);
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState("");

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const w = await getWorkers(orgId);
      setWorkers(w);
      // Get project counts via assignments
      const { supabaseAdmin } = await import("@/lib/supabase");
      const { data } = await supabaseAdmin
        .from("project_assignments")
        .select("member_id");
      const counts: Record<string, number> = {};
      (data || []).forEach((a: any) => {
        if (a.member_id) counts[a.member_id] = (counts[a.member_id] || 0) + 1;
      });
      setProjectCounts(counts);
    } catch (err: any) {
      toast.error(err.message || "Failed to load workers");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selectedWorker) { setWorkerProjects([]); return; }
    getWorkerProjects(selectedWorker.id).then(setWorkerProjects).catch(() => {});
  }, [selectedWorker?.id]);

  const resetForm = () => {
    setFormName(""); setFormEmail(""); setFormPhone(""); setFormRole("");
  };

  const handleCreate = async () => {
    if (!orgId || !userId) return;
    if (!formName.trim() || !formEmail.trim()) {
      toast.error("Name and email are required");
      return;
    }
    try {
      await createWorker({
        org_id: orgId,
        name: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim() || null,
        role: formRole.trim() || null,
        created_by: userId,
      });
      // Send Clerk invite
      try {
        const res = await fetch("/api/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formEmail.trim(), role: "worker" }),
        });
        if (res.ok) {
          toast.success(`Invitation sent to ${formEmail.trim()}`);
        }
      } catch {}
      resetForm();
      setShowNew(false);
      toast.success("Worker created");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to create worker");
    }
  };

  const openEdit = (worker: Worker) => {
    setFormName(worker.name);
    setFormEmail(worker.email);
    setFormPhone(worker.phone || "");
    setFormRole(worker.role || "");
    setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!selectedWorker || !formName.trim() || !formEmail.trim()) return;
    try {
      await updateWorker(selectedWorker.id, {
        name: formName.trim(),
        email: formEmail.trim(),
        phone: formPhone.trim() || null,
        role: formRole.trim() || null,
      });
      setSelectedWorker({ ...selectedWorker, name: formName.trim(), email: formEmail.trim(), phone: formPhone.trim() || null, role: formRole.trim() || null });
      setShowEdit(false);
      toast.success("Worker updated");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update worker");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWorker(id);
      setSelectedWorker(null);
      toast.success("Worker deleted");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete worker");
    }
  };

  if (loading) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  // Worker detail view
  if (selectedWorker) {
    return (
      <div className="p-4 max-w-4xl mx-auto w-full">
        <Button variant="ghost" className="mb-4" onClick={() => { setSelectedWorker(null); resetForm(); }}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Workers
        </Button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">{selectedWorker.name}</h1>
            {selectedWorker.role && <p className="text-sm text-muted-foreground">{selectedWorker.role}</p>}
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => openEdit(selectedWorker)}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Worker</AlertDialogTitle>
                    <AlertDialogDescription>
                      Permanently delete &quot;{selectedWorker.name}&quot;? This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(selectedWorker.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{selectedWorker.email}</span>
            </CardContent>
          </Card>
          {selectedWorker.phone && (
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{selectedWorker.phone}</span>
              </CardContent>
            </Card>
          )}
          {selectedWorker.role && (
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{selectedWorker.role}</span>
              </CardContent>
            </Card>
          )}
        </div>

        <h2 className="text-lg font-semibold mb-3">Projects ({workerProjects.length})</h2>
        {workerProjects.length === 0 ? (
          <Card><CardContent className="pt-6 text-center text-muted-foreground">No projects assigned to this worker.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {workerProjects.map((p) => (
              <Card key={p.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      {p.description && <p className="text-sm text-muted-foreground line-clamp-1">{p.description}</p>}
                    </div>
                    <Badge variant={p.status === "completed" ? "default" : "secondary"}>{p.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit dialog */}
        <Dialog open={showEdit} onOpenChange={setShowEdit}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Worker</DialogTitle>
              <DialogDescription>Update worker information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Name *</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} /></div>
              <div><Label>Email *</Label><Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} /></div>
              <div><Label>Phone</Label><Input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} /></div>
              <div><Label>Role</Label><Input value={formRole} onChange={(e) => setFormRole(e.target.value)} /></div>
              <Button onClick={handleEdit} className="w-full" disabled={!formName.trim() || !formEmail.trim()}>Save Changes</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Worker list view
  const filtered = workers.filter((w) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return w.name.toLowerCase().includes(q) || w.email.toLowerCase().includes(q) || (w.phone || "").toLowerCase().includes(q) || (w.role || "").toLowerCase().includes(q);
  });

  return (
    <div className="p-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Workers</h1>
        {isAdmin && (
          <Button onClick={() => { resetForm(); setShowNew(true); }}><Plus className="h-4 w-4 mr-1" /> New Worker</Button>
        )}
      </div>

      {workers.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search workers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-8" />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          {workers.length === 0 ? "No workers yet. Add your first one!" : "No workers match your search."}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((w) => (
            <Card key={w.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedWorker(w)}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{w.name}</p>
                    {w.role && <p className="text-sm text-muted-foreground truncate flex items-center gap-1"><Briefcase className="h-3 w-3" />{w.role}</p>}
                    <p className="text-sm text-muted-foreground truncate flex items-center gap-1 mt-1"><Mail className="h-3 w-3" />{w.email}</p>
                    {w.phone && <p className="text-sm text-muted-foreground truncate flex items-center gap-1"><Phone className="h-3 w-3" />{w.phone}</p>}
                  </div>
                  <Badge variant="secondary" className="ml-2 shrink-0">
                    <FolderOpen className="h-3 w-3 mr-1" />{projectCounts[w.id] || 0}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New worker dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Worker</DialogTitle>
            <DialogDescription>Add a new worker to your organization</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Jane Doe" /></div>
            <div><Label>Email *</Label><Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="e.g. jane@example.com" /></div>
            <div><Label>Phone</Label><Input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="e.g. (555) 123-4567" /></div>
            <div><Label>Role</Label><Input value={formRole} onChange={(e) => setFormRole(e.target.value)} placeholder="e.g. Developer, Designer" /></div>
            <Button onClick={handleCreate} className="w-full" disabled={!formName.trim() || !formEmail.trim()}>Create Worker</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WorkersPageInner() {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />
      <WorkersInner />
    </div>
  );
}

export default function WorkersPage() {
  return <AuthGate><WorkersPageInner /></AuthGate>;
}
