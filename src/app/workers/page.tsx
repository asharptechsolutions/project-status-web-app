"use client";
import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getWorkers, createWorker, updateWorker, deleteWorker } from "@/lib/firestore";
import type { Worker } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Pencil, Plus, Trash2, UserCircle } from "lucide-react";
import { toast } from "sonner";

function WorkersInner() {
  const { user } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [editWorker, setEditWorker] = useState<Worker | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    try { setWorkers(await getWorkers(user.uid)); } catch (error: any) { toast.error(error.message || "Failed to load workers"); } finally { setLoading(false); }
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    try {
      await createWorker({ name, role: role || undefined, userId: user.uid });
      setName(""); setRole(""); setShowNew(false); toast.success("Worker added"); load();
    } catch (error: any) { toast.error(error.message || "Failed to add worker"); }
  };

  const openEdit = (w: Worker) => {
    setEditWorker(w);
    setEditName(w.name);
    setEditRole(w.role || "");
  };

  const handleUpdate = async () => {
    if (!editWorker || !editName.trim()) return;
    try {
      await updateWorker(editWorker.id, { name: editName.trim(), role: editRole.trim() || undefined });
      setEditWorker(null);
      toast.success("Worker updated");
      load();
    } catch (error: any) { toast.error(error.message || "Failed to update worker"); }
  };

  if (loading) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="p-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Workers</h1>
        <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> Add Worker</Button>
      </div>

      {workers.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No workers added yet. Add your team members!</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {workers.map((w) => (
            <Card key={w.id}>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <UserCircle className="h-10 w-10 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{w.name}</p>
                  {w.role && <p className="text-sm text-muted-foreground truncate">{w.role}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(w)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={async () => { try { await deleteWorker(w.id); toast.success("Worker removed"); load(); } catch (error: any) { toast.error(error.message || "Failed to delete worker"); } }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Worker</DialogTitle>
            <DialogDescription>Add a team member to assign to workflow stages</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Smith" /></div>
            <div><Label>Role (optional)</Label><Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. CNC Operator" /></div>
            <Button onClick={handleCreate} className="w-full" disabled={!name.trim()}>Add Worker</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editWorker} onOpenChange={(open) => { if (!open) setEditWorker(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Worker</DialogTitle>
            <DialogDescription>Update worker name and role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div><Label>Role (optional)</Label><Input value={editRole} onChange={(e) => setEditRole(e.target.value)} /></div>
            <Button onClick={handleUpdate} className="w-full" disabled={!editName.trim()}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function WorkersPage() {
  return (
    <AuthGate>
      <div className="min-h-[100dvh] flex flex-col">
        <Navbar />
        <WorkersInner />
      </div>
    </AuthGate>
  );
}
