"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getMembers } from "@/lib/data";
import type { Member } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2, UserCircle, Loader2, Mail, CheckCircle2, Clock, RefreshCw, ArrowLeft, Search, X, ArrowUpDown, Shield, Wrench, Users, Download } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { generateCsv, downloadCsv } from "@/lib/csv";
import { Pagination } from "@/components/pagination";

function WorkersInner() {
  const { orgId, userId, isAdmin } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  // Invite dialog
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviting, setInviting] = useState(false);

  // Edit dialog
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState<"owner" | "worker">("worker");

  const [resendingId, setResendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const m = await getMembers(orgId);
      setMembers(m);
    } catch (err: any) {
      toast.error(err.message || "Failed to load workers");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const workerMembers = members.filter((m) => m.role === "owner" || m.role === "worker");

  const handleInvite = async () => {
    if (!orgId || !inviteName.trim() || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/invite/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.toLowerCase().trim(),
          name: inviteName.trim(),
          role: "worker",
          teamId: orgId,
          phone: invitePhone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite");
      setShowInvite(false);
      setInviteName(""); setInviteEmail(""); setInvitePhone("");
      toast.success(data.invited ? `Invitation sent to ${inviteEmail}` : `${inviteName} added as worker`);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to invite worker");
    } finally {
      setInviting(false);
    }
  };

  const handleResendInvite = async (m: Member) => {
    if (!orgId) return;
    setResendingId(m.id);
    try {
      const res = await fetch("/api/invite/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: m.email, name: m.name, role: m.role, teamId: orgId, phone: m.phone || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resend");
      toast.success(`Invitation resent to ${m.email}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to resend invitation");
    } finally {
      setResendingId(null);
    }
  };

  const openEdit = (m: Member) => {
    setEditMember(m);
    setEditName(m.name);
    setEditEmail(m.email);
    setEditPhone(m.phone);
    setEditRole(m.role as "owner" | "worker");
  };

  const handleUpdate = async () => {
    if (!editMember) return;
    try {
      const res = await fetch("/api/members/update/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editMember.user_id, teamId: editMember.team_id,
          name: editName.trim(), email: editEmail.toLowerCase().trim(),
          phone: editPhone.trim(), role: editRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update member");
      setEditMember(null);
      toast.success("Member updated");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update member");
    }
  };

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [searchQuery, statusFilter, sortBy]);

  if (!isAdmin) {
    return (
      <div className="p-4 max-w-7xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-4">Workers</h1>
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Only admins can manage workers.</CardContent></Card>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const filteredWorkers = workerMembers
    .filter((m) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" ? true : statusFilter === "accepted" ? m.joined_at !== null : m.joined_at === null;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "newest": return (b.created_at || "").localeCompare(a.created_at || "");
        default: return 0;
      }
    });

  const totalPages = Math.ceil(filteredWorkers.length / PAGE_SIZE);
  const paginatedWorkers = filteredWorkers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExportCsv = () => {
    const columns = [
      { key: "name", header: "Name" },
      { key: "email", header: "Email" },
      { key: "phone", header: "Phone" },
      { key: "role", header: "Role" },
      { key: "status", header: "Status" },
      { key: "joined", header: "Joined Date" },
      { key: "created", header: "Created" },
    ];
    const rows = filteredWorkers.map((m) => ({
      name: m.name,
      email: m.email,
      phone: m.phone || "",
      role: m.role === "owner" ? "Admin" : "Worker",
      status: m.joined_at ? "Accepted" : "Pending",
      joined: m.joined_at ? new Date(m.joined_at).toLocaleDateString() : "",
      created: m.created_at ? new Date(m.created_at).toLocaleDateString() : "",
    }));
    const csv = generateCsv(columns, rows);
    downloadCsv(csv, `workers-export-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(`Exported ${rows.length} workers`);
  };

  return (
    <div className="p-4 max-w-7xl mx-auto w-full">
      <Button variant="ghost" className="mb-4" onClick={() => router.push("/crm/")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to CRM
      </Button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Workers</h1>
        <div className="flex gap-2">
          {filteredWorkers.length > 0 && (
            <Button variant="outline" onClick={handleExportCsv}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
          )}
          <Button onClick={() => { setShowInvite(true); setInviteName(""); setInviteEmail(""); setInvitePhone(""); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Worker
          </Button>
        </div>
      </div>

      {workerMembers.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search workers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-8" />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <ArrowUpDown className="h-4 w-4 mr-2" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name A-Z</SelectItem>
              <SelectItem value="newest">Newest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {filteredWorkers.length === 0 ? (
        workerMembers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No workers yet"
            description="Workers are team members who progress project stages. Invite them by email to get started."
            actionLabel="Invite Worker"
            onAction={() => { setShowInvite(true); setInviteName(""); setInviteEmail(""); setInvitePhone(""); }}
          />
        ) : (
          <Card><CardContent className="pt-6 text-center text-muted-foreground">
            No workers match your search.
          </CardContent></Card>
        )
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {paginatedWorkers.map((m) => (
              <Card key={m.id}>
                <CardContent className="pt-4 pb-4 flex items-center gap-4">
                  <UserCircle className="h-10 w-10 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{m.name || "Pending"}</p>
                      <Badge variant="outline" className="shrink-0">
                        {m.role === "owner" ? <><Shield className="h-3 w-3 mr-1" />Admin</> : <><Wrench className="h-3 w-3 mr-1" />Worker</>}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{m.email}</p>
                    {m.phone && <p className="text-sm text-muted-foreground truncate">{m.phone}</p>}
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {m.joined_at ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-full px-2.5 py-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Accepted
                      </span>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-full px-2.5 py-1">
                          <Clock className="h-3.5 w-3.5" /> Pending
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => handleResendInvite(m)} disabled={resendingId === m.id} title="Resend invitation">
                          {resendingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
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
                            <AlertDialogDescription>Remove {m.name || m.email} from the organization?</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={async () => {
                              try {
                                const res = await fetch("/api/members/delete/", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ userId: m.user_id, teamId: m.team_id }),
                                });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error || "Failed to remove member");
                                toast.success("Removed");
                                load();
                              } catch (err: any) { toast.error(err.message); }
                            }}>Remove</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} totalCount={filteredWorkers.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </>
      )}

      {/* Invite dialog */}
      <Dialog open={showInvite} onOpenChange={(open) => { if (!open) setShowInvite(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Worker</DialogTitle>
            <DialogDescription>Add a worker to your organization. An invitation email will be sent so they can create their account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="e.g. John Smith" /></div>
            <div><Label>Email</Label><Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="john@example.com" /></div>
            <div><Label>Phone (optional)</Label><Input value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} placeholder="(555) 123-4567" /></div>
            <Button onClick={handleInvite} className="w-full" disabled={!inviteName.trim() || !inviteEmail.trim() || inviting}>
              {inviting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              {inviting ? "Sending..." : "Send Invitation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editMember} onOpenChange={(open) => { if (!open) setEditMember(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
            <DialogDescription>Update member details and role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /></div>
            <div>
              <Label>Role</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as "owner" | "worker")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Admin — Full access</SelectItem>
                  <SelectItem value="worker">Worker — Update stages</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleUpdate} className="w-full" disabled={!editName.trim() || !editEmail.trim()}>Save Changes</Button>
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
