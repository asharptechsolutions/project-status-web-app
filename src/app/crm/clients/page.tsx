"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getMembers, getCompanies } from "@/lib/data";
import type { Member, Company } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Pencil, Plus, Trash2, UserCircle, Loader2, Mail, CheckCircle2, Clock, RefreshCw, ArrowLeft, Search, X, ArrowUpDown, Building2, Eye, Download } from "lucide-react";
import { toast } from "sonner";
import { trackActivity } from "@/lib/activity";
import { EmptyState } from "@/components/empty-state";
import { generateCsv, downloadCsv } from "@/lib/csv";
import { Pagination } from "@/components/pagination";

function ClientsInner() {
  const { orgId, userId, isAdmin, member } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  // Invite dialog
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteCompanyId, setInviteCompanyId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  // Edit dialog
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCompanyId, setEditCompanyId] = useState<string | null>(null);

  const [resendingId, setResendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const [m, c] = await Promise.all([getMembers(orgId), getCompanies(orgId)]);
      setMembers(m);
      setCompanies(c);
    } catch (err: any) {
      toast.error(err.message || "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const clientMembers = useMemo(() => members.filter((m) => m.role === "client"), [members]);

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
          role: "client",
          teamId: orgId,
          phone: invitePhone.trim() || undefined,
          ...(inviteCompanyId ? { companyId: inviteCompanyId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite");
      setShowInvite(false);
      setInviteName(""); setInviteEmail(""); setInvitePhone(""); setInviteCompanyId(null);
      toast.success(data.invited ? `Invitation sent to ${inviteEmail}` : `${inviteName} added as client`);
      trackActivity({
        teamId: orgId,
        actorId: userId!,
        actorName: member?.name || "",
        action: "invited",
        entityType: "member",
        entityName: inviteName.trim(),
        projectId: null,
        metadata: { role: "client", email: inviteEmail.toLowerCase().trim() },
      });
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to invite client");
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
    setEditCompanyId(m.company_id);
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
          phone: editPhone.trim(), role: "client",
          companyId: editCompanyId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update client");
      setEditMember(null);
      toast.success("Client updated");
      trackActivity({
        teamId: editMember.team_id,
        actorId: userId!,
        actorName: member?.name || "",
        action: "updated",
        entityType: "member",
        entityId: editMember.id,
        entityName: editName.trim(),
        projectId: null,
        metadata: { email: editEmail.toLowerCase().trim(), role: "client", companyId: editCompanyId },
      });
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update client");
    }
  };

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [searchQuery, companyFilter, statusFilter, sortBy]);

  if (!isAdmin) {
    return (
      <div className="p-4 max-w-7xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-4">Clients</h1>
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Only admins can manage clients.</CardContent></Card>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const filteredClients = clientMembers
    .filter((m) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
      const matchesCompany = companyFilter === "all" ? true : companyFilter === "none" ? !m.company_id : m.company_id === companyFilter;
      const matchesStatus = statusFilter === "all" ? true : statusFilter === "accepted" ? m.joined_at !== null : m.joined_at === null;
      return matchesSearch && matchesCompany && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "newest": return (b.created_at || "").localeCompare(a.created_at || "");
        default: return 0;
      }
    });

  const totalPages = Math.ceil(filteredClients.length / PAGE_SIZE);
  const paginatedClients = filteredClients.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleExportCsv = () => {
    const columns = [
      { key: "name", header: "Name" },
      { key: "email", header: "Email" },
      { key: "phone", header: "Phone" },
      { key: "company", header: "Company" },
      { key: "status", header: "Status" },
      { key: "joined", header: "Joined Date" },
      { key: "created", header: "Created" },
    ];
    const rows = filteredClients.map((m) => ({
      name: m.name,
      email: m.email,
      phone: m.phone || "",
      company: m.company_name || "",
      status: m.joined_at ? "Accepted" : "Pending",
      joined: m.joined_at ? new Date(m.joined_at).toLocaleDateString() : "",
      created: m.created_at ? new Date(m.created_at).toLocaleDateString() : "",
    }));
    const csv = generateCsv(columns, rows);
    downloadCsv(csv, `clients-export-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(`Exported ${rows.length} clients`);
  };

  return (
    <div className="p-4 max-w-7xl mx-auto w-full">
      <Button variant="ghost" className="mb-4" onClick={() => router.push("/crm/")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to CRM
      </Button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Clients</h1>
        <div className="flex gap-2">
          {filteredClients.length > 0 && (
            <Button variant="outline" onClick={handleExportCsv}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
          )}
          <Button onClick={() => { setShowInvite(true); setInviteName(""); setInviteEmail(""); setInvitePhone(""); setInviteCompanyId(null); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Client
          </Button>
        </div>
      </div>

      {clientMembers.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search clients..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-8" />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {companies.length > 0 && (
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <Building2 className="h-4 w-4 mr-2" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                <SelectItem value="none">No Company</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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

      {filteredClients.length === 0 ? (
        clientMembers.length === 0 ? (
          <EmptyState
            icon={Eye}
            title="No clients yet"
            description="Clients get a read-only view of their project progress. Add clients and assign them to projects."
            actionLabel="Add Client"
            onAction={() => setShowInvite(true)}
          />
        ) : (
          <Card><CardContent className="pt-6 text-center text-muted-foreground">
            No clients match your filters.
          </CardContent></Card>
        )
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {paginatedClients.map((m) => (
              <Card key={m.id}>
                <CardContent className="pt-4 pb-4 flex items-center gap-4">
                  <UserCircle className="h-10 w-10 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{m.name || "Pending"}</p>
                    <p className="text-sm text-muted-foreground truncate">{m.email}</p>
                    {m.phone && <p className="text-sm text-muted-foreground truncate">{m.phone}</p>}
                    {m.company_name && (
                      <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3" /> {m.company_name}
                      </p>
                    )}
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
                            <AlertDialogTitle>Remove Client</AlertDialogTitle>
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
                                if (!res.ok) throw new Error(data.error || "Failed to remove client");
                                toast.success("Removed");
                                trackActivity({
                                  teamId: m.team_id,
                                  actorId: userId!,
                                  actorName: member?.name || "",
                                  action: "deleted",
                                  entityType: "member",
                                  entityId: m.id,
                                  entityName: m.name || m.email,
                                  projectId: null,
                                  metadata: { role: "client", email: m.email },
                                });
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
          <Pagination page={page} totalPages={totalPages} totalCount={filteredClients.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </>
      )}

      {/* Invite dialog */}
      <Dialog open={showInvite} onOpenChange={(open) => { if (!open) setShowInvite(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Client</DialogTitle>
            <DialogDescription>Add a client to your organization. An invitation email will be sent so they can create their account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="e.g. John Smith" /></div>
            <div><Label>Email</Label><Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="john@example.com" /></div>
            <div><Label>Phone (optional)</Label><Input value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} placeholder="(555) 123-4567" /></div>
            {companies.length > 0 && (
              <div>
                <Label>Company (optional)</Label>
                <Select value={inviteCompanyId || "__none__"} onValueChange={(v) => setInviteCompanyId(v === "__none__" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Select company..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No Company</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update client details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /></div>
            {companies.length > 0 && (
              <div>
                <Label>Company</Label>
                <Select value={editCompanyId || "__none__"} onValueChange={(v) => setEditCompanyId(v === "__none__" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Select company..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No Company</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleUpdate} className="w-full" disabled={!editName.trim() || !editEmail.trim()}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ClientsPage() {
  return (
    <AuthGate>
      <div className="min-h-[100dvh] flex flex-col">
        <Navbar />
        <ClientsInner />
      </div>
    </AuthGate>
  );
}
