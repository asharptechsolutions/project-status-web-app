"use client";
import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getClients, createClient, updateClient, deleteClient, getClientProjects } from "@/lib/data";
import type { Client, Project } from "@/lib/types";
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
import { Plus, Search, X, Pencil, Trash2, ArrowLeft, Building2, Mail, Phone, FolderOpen } from "lucide-react";
import { toast } from "sonner";

function ClientsInner() {
  const { orgId, userId, isAdmin } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientProjects, setClientProjects] = useState<Project[]>([]);
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});

  // Form state
  const [formName, setFormName] = useState("");
  const [formCompany, setFormCompany] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const c = await getClients(orgId);
      setClients(c);
      // Get project counts
      const { supabaseAdmin } = await import("@/lib/supabase");
      const { data } = await supabaseAdmin
        .from("projects")
        .select("client_id")
        .not("client_id", "is", null);
      const counts: Record<string, number> = {};
      (data || []).forEach((p: any) => {
        if (p.client_id) counts[p.client_id] = (counts[p.client_id] || 0) + 1;
      });
      setProjectCounts(counts);
    } catch (err: any) {
      toast.error(err.message || "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selectedClient) { setClientProjects([]); return; }
    getClientProjects(selectedClient.id).then(setClientProjects).catch(() => {});
  }, [selectedClient?.id]);

  const resetForm = () => {
    setFormName(""); setFormCompany(""); setFormEmail(""); setFormPhone("");
  };

  const handleCreate = async () => {
    if (!orgId || !userId) return;
    if (!formName.trim() || !formEmail.trim()) {
      toast.error("Name and email are required");
      return;
    }
    try {
      await createClient({
        org_id: orgId,
        name: formName.trim(),
        company: formCompany.trim() || null,
        email: formEmail.trim(),
        phone: formPhone.trim() || null,
        created_by: userId,
      });
      // Send Clerk invite
      try {
        const res = await fetch("/api/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formEmail.trim(), role: "client" }),
        });
        const data = await res.json();
        if (res.ok) {
          toast.success(`Invitation sent to ${formEmail.trim()}`);
        }
      } catch {}
      resetForm();
      setShowNew(false);
      toast.success("Client created");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to create client");
    }
  };

  const openEdit = (client: Client) => {
    setFormName(client.name);
    setFormCompany(client.company || "");
    setFormEmail(client.email);
    setFormPhone(client.phone || "");
    setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!selectedClient || !formName.trim() || !formEmail.trim()) return;
    try {
      await updateClient(selectedClient.id, {
        name: formName.trim(),
        company: formCompany.trim() || null,
        email: formEmail.trim(),
        phone: formPhone.trim() || null,
      });
      setSelectedClient({ ...selectedClient, name: formName.trim(), company: formCompany.trim() || null, email: formEmail.trim(), phone: formPhone.trim() || null });
      setShowEdit(false);
      toast.success("Client updated");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update client");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteClient(id);
      setSelectedClient(null);
      toast.success("Client deleted");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete client");
    }
  };

  if (loading) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  // Client detail view
  if (selectedClient) {
    return (
      <div className="p-4 max-w-4xl mx-auto w-full">
        <Button variant="ghost" className="mb-4" onClick={() => { setSelectedClient(null); resetForm(); }}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Clients
        </Button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">{selectedClient.name}</h1>
            {selectedClient.company && <p className="text-sm text-muted-foreground">{selectedClient.company}</p>}
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => openEdit(selectedClient)}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Client</AlertDialogTitle>
                    <AlertDialogDescription>
                      Permanently delete &quot;{selectedClient.name}&quot;? This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(selectedClient.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
              <span className="text-sm">{selectedClient.email}</span>
            </CardContent>
          </Card>
          {selectedClient.phone && (
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{selectedClient.phone}</span>
              </CardContent>
            </Card>
          )}
          {selectedClient.company && (
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{selectedClient.company}</span>
              </CardContent>
            </Card>
          )}
        </div>

        <h2 className="text-lg font-semibold mb-3">Projects ({clientProjects.length})</h2>
        {clientProjects.length === 0 ? (
          <Card><CardContent className="pt-6 text-center text-muted-foreground">No projects assigned to this client.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {clientProjects.map((p) => (
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
              <DialogTitle>Edit Client</DialogTitle>
              <DialogDescription>Update client information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Name *</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} /></div>
              <div><Label>Company</Label><Input value={formCompany} onChange={(e) => setFormCompany(e.target.value)} /></div>
              <div><Label>Email *</Label><Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} /></div>
              <div><Label>Phone</Label><Input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} /></div>
              <Button onClick={handleEdit} className="w-full" disabled={!formName.trim() || !formEmail.trim()}>Save Changes</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Client list view
  const filtered = clients.filter((c) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.company || "").toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.phone || "").toLowerCase().includes(q);
  });

  return (
    <div className="p-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        {isAdmin && (
          <Button onClick={() => { resetForm(); setShowNew(true); }}><Plus className="h-4 w-4 mr-1" /> New Client</Button>
        )}
      </div>

      {clients.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search clients..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-8" />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          {clients.length === 0 ? "No clients yet. Add your first one!" : "No clients match your search."}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((c) => (
            <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedClient(c)}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{c.name}</p>
                    {c.company && <p className="text-sm text-muted-foreground truncate flex items-center gap-1"><Building2 className="h-3 w-3" />{c.company}</p>}
                    <p className="text-sm text-muted-foreground truncate flex items-center gap-1 mt-1"><Mail className="h-3 w-3" />{c.email}</p>
                    {c.phone && <p className="text-sm text-muted-foreground truncate flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</p>}
                  </div>
                  <Badge variant="secondary" className="ml-2 shrink-0">
                    <FolderOpen className="h-3 w-3 mr-1" />{projectCounts[c.id] || 0}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New client dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Client</DialogTitle>
            <DialogDescription>Add a new client to your organization</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. John Smith" /></div>
            <div><Label>Company</Label><Input value={formCompany} onChange={(e) => setFormCompany(e.target.value)} placeholder="e.g. Acme Corp" /></div>
            <div><Label>Email *</Label><Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="e.g. john@example.com" /></div>
            <div><Label>Phone</Label><Input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="e.g. (555) 123-4567" /></div>
            <Button onClick={handleCreate} className="w-full" disabled={!formName.trim() || !formEmail.trim()}>Create Client</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientsPageInner() {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />
      <ClientsInner />
    </div>
  );
}

export default function ClientsPage() {
  return <AuthGate><ClientsPageInner /></AuthGate>;
}
