"use client";
import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getMembers, createMember, updateMember, deleteMember, getProjects, getProjectAssignments, assignProject, unassignProject } from "@/lib/data";
import type { Member, Project, ProjectAssignment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Pencil, Plus, Trash2, UserCircle, Shield, Wrench, Eye } from "lucide-react";
import { toast } from "sonner";

function MembersInner() {
  const { orgId, userId, isAdmin } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "worker" | "client">("worker");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      setMembers(await getMembers(orgId));
    } catch (err: any) {
      toast.error(err.message || "Failed to load members");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!orgId || !name.trim() || !email.trim()) return;
    try {
      await createMember({
        user_id: `pending_${email.toLowerCase().trim()}`,
        team_id: orgId,
        role,
        email: email.toLowerCase().trim(),
        name: name.trim(),
      });
      setName(""); setEmail(""); setRole("worker"); setShowNew(false);
      toast.success("Member added");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to add member");
    }
  };

  const handleUpdate = async () => {
    if (!editMember) return;
    try {
      await updateMember(editMember.id, {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        role,
      });
      setEditMember(null);
      toast.success("Member updated");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update member");
    }
  };

  const openEdit = (m: Member) => {
    setEditMember(m);
    setName(m.name);
    setEmail(m.email);
    setRole(m.role);
  };

  const roleIcon = (r: string) => {
    if (r === "admin") return <Shield className="h-4 w-4 text-blue-500" />;
    if (r === "worker") return <Wrench className="h-4 w-4 text-orange-500" />;
    return <Eye className="h-4 w-4 text-green-500" />;
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

  return (
    <div className="p-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Members</h1>
        <Button onClick={() => { setName(""); setEmail(""); setRole("worker"); setShowNew(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Member
        </Button>
      </div>

      <div className="mb-6 p-4 bg-muted/50 rounded-lg">
        <h3 className="font-medium text-sm mb-2">Role Guide</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
          <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-blue-500" /> <strong>Admin</strong> — Full access, manage everything</div>
          <div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-orange-500" /> <strong>Worker</strong> — View all projects, update stages</div>
          <div className="flex items-center gap-2"><Eye className="h-4 w-4 text-green-500" /> <strong>Client</strong> — View assigned projects only</div>
        </div>
      </div>

      {members.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No members yet. Add your team!</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {members.map((m) => (
            <Card key={m.id}>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                <UserCircle className="h-10 w-10 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  <Badge variant={roleColor(m.role)} className="mt-1 text-xs">
                    {roleIcon(m.role)}
                    <span className="ml-1 capitalize">{m.role}</span>
                  </Badge>
                </div>
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(m)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {m.user_id !== userId && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Member</AlertDialogTitle>
                          <AlertDialogDescription>Remove {m.name} from the organization?</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={async () => { try { await deleteMember(m.id); toast.success("Removed"); load(); } catch (err: any) { toast.error(err.message); } }}>Remove</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add member dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Member</DialogTitle>
            <DialogDescription>Add a team member or client to your organization</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Smith" /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" /></div>
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — Full access</SelectItem>
                  <SelectItem value="worker">Worker — Update stages</SelectItem>
                  <SelectItem value="client">Client — View only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} className="w-full" disabled={!name.trim() || !email.trim()}>Add Member</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit member dialog */}
      <Dialog open={!!editMember} onOpenChange={(open) => { if (!open) setEditMember(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
            <DialogDescription>Update member details and role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div>
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="worker">Worker</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleUpdate} className="w-full" disabled={!name.trim() || !email.trim()}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function MembersPage() {
  return (
    <AuthGate>
      <div className="min-h-[100dvh] flex flex-col">
        <Navbar />
        <MembersInner />
      </div>
    </AuthGate>
  );
}
