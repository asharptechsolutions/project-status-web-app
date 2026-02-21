"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getMembers, getCompanies, createCompany } from "@/lib/data";
import type { Member, Company } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Mail, Building2, Wrench, Eye, ChevronRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

function CRMInner() {
  const { orgId, isAdmin } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Company dialog
  const [showCompanyDialog, setShowCompanyDialog] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);

  // Invite dialog
  const [inviteRole, setInviteRole] = useState<"worker" | "client" | null>(null);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteCompanyId, setInviteCompanyId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const [m, c] = await Promise.all([getMembers(orgId), getCompanies(orgId)]);
      setMembers(m);
      setCompanies(c);
    } catch (err: any) {
      toast.error(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const workerCount = members.filter((m) => m.role === "owner" || m.role === "worker").length;
  const clientCount = members.filter((m) => m.role === "client").length;

  const handleSaveCompany = async () => {
    if (!orgId || !companyName.trim()) return;
    setSavingCompany(true);
    try {
      await createCompany({
        team_id: orgId,
        name: companyName.trim(),
        email: companyEmail.trim() || "",
        phone: companyPhone.trim() || "",
        address: companyAddress.trim() || "",
      });
      toast.success("Company created");
      setShowCompanyDialog(false);
      setCompanyName(""); setCompanyEmail(""); setCompanyPhone(""); setCompanyAddress("");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to create company");
    } finally {
      setSavingCompany(false);
    }
  };

  const handleInvite = async () => {
    if (!orgId || !inviteRole || !inviteName.trim() || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/invite/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.toLowerCase().trim(),
          name: inviteName.trim(),
          role: inviteRole,
          teamId: orgId,
          phone: invitePhone.trim() || undefined,
          ...(inviteCompanyId ? { companyId: inviteCompanyId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite");
      setInviteRole(null);
      setInviteName(""); setInviteEmail(""); setInvitePhone(""); setInviteCompanyId(null);
      toast.success(data.invited ? `Invitation sent to ${inviteEmail}` : `${inviteName} added to team`);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to invite member");
    } finally {
      setInviting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-4 max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-4">CRM</h1>
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Only admins can manage members.</CardContent></Card>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const cards = [
    {
      label: "Companies",
      count: companies.length,
      icon: Building2,
      iconColor: "text-purple-500",
      bgColor: "bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800",
      href: "/crm/companies/",
      onAdd: (e: React.MouseEvent) => {
        e.stopPropagation();
        setCompanyName(""); setCompanyEmail(""); setCompanyPhone(""); setCompanyAddress("");
        setShowCompanyDialog(true);
      },
    },
    {
      label: "Workers",
      count: workerCount,
      icon: Wrench,
      iconColor: "text-orange-500",
      bgColor: "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800",
      href: "/crm/workers/",
      onAdd: (e: React.MouseEvent) => {
        e.stopPropagation();
        setInviteRole("worker"); setInviteName(""); setInviteEmail(""); setInvitePhone(""); setInviteCompanyId(null);
      },
    },
    {
      label: "Clients",
      count: clientCount,
      icon: Eye,
      iconColor: "text-green-500",
      bgColor: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
      href: "/crm/clients/",
      onAdd: (e: React.MouseEvent) => {
        e.stopPropagation();
        setInviteRole("client"); setInviteName(""); setInviteEmail(""); setInvitePhone(""); setInviteCompanyId(null);
      },
    },
  ];

  return (
    <div className="p-4 max-w-4xl mx-auto w-full">
      <h1 className="text-2xl font-bold mb-6">CRM</h1>

      <div className="grid gap-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card
              key={card.label}
              className={`cursor-pointer hover:shadow-md transition-shadow border ${card.bgColor}`}
              onClick={() => router.push(card.href)}
            >
              <CardContent className="pt-6 pb-6">
                <div className="flex items-center justify-between mb-4">
                  <Icon className={`h-8 w-8 ${card.iconColor}`} />
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{card.count}</p>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={card.onAdd}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Company add dialog */}
      <Dialog open={showCompanyDialog} onOpenChange={(open) => { if (!open) setShowCompanyDialog(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Company</DialogTitle>
            <DialogDescription>Create a new company to organize your clients</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Company Name</Label><Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Acme Construction" autoFocus /></div>
            <div><Label>Email (optional)</Label><Input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="contact@acme.com" /></div>
            <div><Label>Phone (optional)</Label><Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="(555) 123-4567" /></div>
            <div><Label>Address (optional)</Label><Textarea value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder="123 Main St, City, State" rows={2} /></div>
            <Button onClick={handleSaveCompany} className="w-full" disabled={!companyName.trim() || savingCompany}>
              {savingCompany ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Building2 className="h-4 w-4 mr-2" />}
              {savingCompany ? "Creating..." : "Create Company"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      <Dialog open={!!inviteRole} onOpenChange={(open) => { if (!open) setInviteRole(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {inviteRole === "worker" ? "Worker" : "Client"}</DialogTitle>
            <DialogDescription>
              Add {inviteRole === "worker" ? "a worker" : "a client"} to your organization. An invitation email will be sent so they can create their account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="e.g. John Smith" /></div>
            <div><Label>Email</Label><Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="john@example.com" /></div>
            <div><Label>Phone (optional)</Label><Input value={invitePhone} onChange={(e) => setInvitePhone(e.target.value)} placeholder="(555) 123-4567" /></div>
            {inviteRole === "client" && companies.length > 0 && (
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
    </div>
  );
}

export default function MembersPage() {
  return (
    <AuthGate>
      <div className="min-h-[100dvh] flex flex-col">
        <Navbar />
        <CRMInner />
      </div>
    </AuthGate>
  );
}
