"use client";
import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getMembers, createMember, updateMember, deleteMember, getMemberProjects } from "@/lib/data";
import type { Member, Project } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Search, X, Pencil, Trash2, ArrowLeft, Mail, Phone, FolderOpen, Briefcase, Shield, Wrench, Eye } from "lucide-react";
import { toast } from "sonner";

function MembersInner() {
  const { orgId, userId, isAdmin } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberProjects, setMemberProjects] = useState<Project[]>([]);
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState<"admin" | "worker" | "client">("worker");

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const m = await getMembers(orgId);
      setMembers(m);
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
      toast.error(err.message || "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selectedMember) { setMemberProjects([]); return; }
    getMemberProjects(selectedMember.id).then(setMemberProjects).catch(() => {});
  }, [selectedMember?.id]);

  const resetForm = () => {
    setFormName(""); setFormEmail(""); setFormPhone(""); setFormRole("worker");
  };

  const handleCreate = async () => {
    if (!orgId || !userId) return;
    if (!formName.trim() || !formEmail.trim()) {
      toast.error("Name and email are required");
      return;
    }
    try {
      await createMember({
        clerk_user_id: `pending_${formEmail.toLowerCase().trim()}`,
        org_id: orgId,
        name: formName.trim(),
        email: formEmail.toLowerCase().trim(),
        phone: formPhone.trim() || null,
        role: formRole,
      });
      // Send Clerk invite
      try {
        const res = await fetch("/api/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: formEmail.trim(), role: "member", orgId }),
        });
        if (res.ok) {
          toast.success(`Invitation sent to ${formEmail.trim()}`);
        }
      } catch {}
      resetForm();
      setShowNew(false);
      toast.success("Member created");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to create member");
    }
  };

  const openEdit = (member: Member) => {
    setFormName(member.name);
    setFormEmail(member.email);
    setFormPhone(member.phone || "");
    setFormRole(member.role);
    setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!selectedMember || !formName.trim() || !formEmail.trim()) return;
    try {
      await updateMember(selectedMember.id, {
        name: formName.trim(),
        email: formEmail.toLowerCase().trim(),
        phone: formPhone.trim() || null,
        role: formRole,
      });
      setSelectedMember({ ...selectedMember, name: formName.trim(), email: formEmail.toLowerCase().trim(), phone: formPhone.trim() || null, role: formRole });
      setShowEdit(false);
      toast.success("Member updated");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update member");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMember(id);
      setSelectedMember(null);
      toast.success("Member deleted");
      await load();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete member");
    }
  };

  const roleIcon = (r: string) => {
    if (r === "admin") return <Shield className="h-3 w-3 text-blue-500" />;
    if (r === "worker") return <Wrench className="h-3 w-3 text-orange-500" />;
    return <Eye className="h-3 w-3 text-green-500" />;
  };

  const roleColor = (r: string): "default" | "secondary" | "outline" => {
    if (r === "admin") return "default";
    if (r === "worker") return "secondary";
    return "outline";
  };

  if (!isAdmin) {
    return (
      <div className="p-4 max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-4">Members</h1>
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Only admins can manage members.</CardContent></Card>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  // Member detail view
  if (selectedMember) {
    return (
      <div className="p-4 max-w-4xl mx-auto w-full">
        <Button variant="ghost" className="mb-4" onClick={() => { setSelectedMember(null); resetForm(); }}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Members
        </Button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">{selectedMember.name}</h1>
            <Badge variant={roleColor(selectedMember.role)} className="mt-1">
              {roleIcon(selectedMember.role)}
              <span className="ml-1 capitalize">{selectedMember.role}</span>
            </Badge>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => openEdit(selectedMember)}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
              {selectedMember.clerk_user_id !== userId && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Member</AlertDialogTitle>
                      <AlertDialogDescription>
                        Permanently remove &quot;{selectedMember.name}&quot;? This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(selectedMember.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{selectedMember.email}</span>
            </CardContent>
          </Card>
          {selectedMember.phone && (
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{selectedMember.phone}</span>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm capitalize">{selectedMember.role}</span>
            </CardContent>
          </Card>
        </div>

        <h2 className="text-lg font-semibold mb-3">Projects ({memberProjects.length})</h2>
        {memberProjects.length === 0 ? (
          <Card><CardContent className="pt-6 text-center text-muted-foreground">No projects assigned to this member.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {memberProjects.map((p) => (
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
              <DialogTitle>Edit Member</DialogTitle>
              <DialogDescription>Update member information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Name *</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} /></div>
              <div><Label>Email *</Label><Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} /></div>
              <div><Label>Phone</Label><Input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} /></div>
              <div>
                <Label>Role</Label>
                <Select value={formRole} onValueChange={(v) => setFormRole(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin — Full access</SelectItem>
                    <SelectItem value="worker">Worker — Update stages</SelectItem>
                    <SelectItem value="client">Client — View only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleEdit} className="w-full" disabled={!formName.trim() || !formEmail.trim()}>Save Changes</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Member list view
  const filtered = members.filter((m) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || (m.phone || "").toLowerCase().includes(q) || m.role.toLowerCase().includes(q);
  });

  return (
    <div className="p-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Members</h1>
        {isAdmin && (
          <Button onClick={() => { resetForm(); setShowNew(true); }}><Plus className="h-4 w-4 mr-1" /> New Member</Button>
        )}
      </div>

      {members.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search members..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-8" />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          {members.length === 0 ? "No members yet. Add your first one!" : "No members match your search."}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((m) => (
            <Card key={m.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedMember(m)}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{m.name}</p>
                    <Badge variant={roleColor(m.role)} className="mt-1 text-xs">
                      {roleIcon(m.role)}
                      <span className="ml-1 capitalize">{m.role}</span>
                    </Badge>
                    <p className="text-sm text-muted-foreground truncate flex items-center gap-1 mt-1"><Mail className="h-3 w-3" />{m.email}</p>
                    {m.phone && <p className="text-sm text-muted-foreground truncate flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</p>}
                  </div>
                  <Badge variant="secondary" className="ml-2 shrink-0">
                    <FolderOpen className="h-3 w-3 mr-1" />{projectCounts[m.id] || 0}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New member dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Member</DialogTitle>
            <DialogDescription>Add a new member to your organization</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name *</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Jane Doe" /></div>
            <div><Label>Email *</Label><Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="e.g. jane@example.com" /></div>
            <div><Label>Phone</Label><Input type="tel" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="e.g. (555) 123-4567" /></div>
            <div>
              <Label>Role</Label>
              <Select value={formRole} onValueChange={(v) => setFormRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — Full access</SelectItem>
                  <SelectItem value="worker">Worker — Update stages</SelectItem>
                  <SelectItem value="client">Client — View only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} className="w-full" disabled={!formName.trim() || !formEmail.trim()}>Create Member</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MembersPageInner() {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />
      <MembersInner />
    </div>
  );
}

export default function MembersPage() {
  return <AuthGate><MembersPageInner /></AuthGate>;
}
