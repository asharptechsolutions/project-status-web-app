"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getMembers, getCompanies, createCompany, updateCompany, deleteCompany } from "@/lib/data";
import type { Member, Company } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Plus, Trash2, Loader2, Building2, Phone, MapPin, MailIcon, ArrowLeft, Search, X, ArrowUpDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

function CompaniesInner() {
  const { orgId, isAdmin } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  // Company dialog
  const [showCompanyDialog, setShowCompanyDialog] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);

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

  const openAddCompany = () => {
    setEditingCompany(null);
    setCompanyName(""); setCompanyEmail(""); setCompanyPhone(""); setCompanyAddress("");
    setShowCompanyDialog(true);
  };

  const openEditCompany = (c: Company) => {
    setEditingCompany(c);
    setCompanyName(c.name);
    setCompanyEmail(c.email || "");
    setCompanyPhone(c.phone || "");
    setCompanyAddress(c.address || "");
    setShowCompanyDialog(true);
  };

  const handleSaveCompany = async () => {
    if (!orgId || !companyName.trim()) return;
    setSavingCompany(true);
    try {
      if (editingCompany) {
        await updateCompany(editingCompany.id, {
          name: companyName.trim(),
          email: companyEmail.trim() || "",
          phone: companyPhone.trim() || "",
          address: companyAddress.trim() || "",
        });
        toast.success("Company updated");
      } else {
        await createCompany({
          team_id: orgId,
          name: companyName.trim(),
          email: companyEmail.trim() || "",
          phone: companyPhone.trim() || "",
          address: companyAddress.trim() || "",
        });
        toast.success("Company created");
      }
      setShowCompanyDialog(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to save company");
    } finally {
      setSavingCompany(false);
    }
  };

  const handleDeleteCompany = async (id: string) => {
    try {
      await deleteCompany(id);
      toast.success("Company deleted");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete company");
    }
  };

  const clientsForCompany = (companyId: string) =>
    members.filter((m) => m.role === "client" && m.company_id === companyId);

  if (!isAdmin) {
    return (
      <div className="p-4 max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-4">Companies</h1>
        <Card><CardContent className="pt-6 text-center text-muted-foreground">Only admins can manage companies.</CardContent></Card>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const filteredCompanies = companies
    .filter((c) => {
      const q = searchQuery.toLowerCase();
      return !q || c.name.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q));
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest": return (b.created_at || "").localeCompare(a.created_at || "");
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        default: return 0;
      }
    });

  return (
    <div className="p-4 max-w-4xl mx-auto w-full">
      <Button variant="ghost" className="mb-4" onClick={() => router.push("/crm/")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to CRM
      </Button>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Companies</h1>
        <Button onClick={openAddCompany}><Plus className="h-4 w-4 mr-1" /> Add Company</Button>
      </div>

      {companies.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search companies..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-8" />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <ArrowUpDown className="h-4 w-4 mr-2" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="name-asc">Name A-Z</SelectItem>
              <SelectItem value="name-desc">Name Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {filteredCompanies.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          {companies.length === 0 ? "No companies yet. Add your first one!" : "No companies match your search."}
        </CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {filteredCompanies.map((c) => {
            const clientCount = clientsForCompany(c.id).length;
            return (
              <Card key={c.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{c.name}</p>
                      {c.email && (
                        <p className="text-sm text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <MailIcon className="h-3 w-3 shrink-0" /> {c.email}
                        </p>
                      )}
                      {c.phone && (
                        <p className="text-sm text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 shrink-0" /> {c.phone}
                        </p>
                      )}
                      {c.address && (
                        <p className="text-sm text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3 shrink-0" /> {c.address}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {clientCount} {clientCount === 1 ? "client" : "clients"}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      <Button variant="ghost" size="sm" onClick={() => openEditCompany(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Company</AlertDialogTitle>
                            <AlertDialogDescription>
                              Delete &ldquo;{c.name}&rdquo;? Clients will not be removed, just disassociated from this company.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteCompany(c.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Company add/edit dialog */}
      <Dialog open={showCompanyDialog} onOpenChange={(open) => { if (!open) setShowCompanyDialog(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCompany ? "Edit Company" : "Add Company"}</DialogTitle>
            <DialogDescription>
              {editingCompany ? "Update company details" : "Create a new company to organize your clients"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Company Name</Label><Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="e.g. Acme Construction" autoFocus /></div>
            <div><Label>Email (optional)</Label><Input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="contact@acme.com" /></div>
            <div><Label>Phone (optional)</Label><Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="(555) 123-4567" /></div>
            <div><Label>Address (optional)</Label><Textarea value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder="123 Main St, City, State" rows={2} /></div>
            <Button onClick={handleSaveCompany} className="w-full" disabled={!companyName.trim() || savingCompany}>
              {savingCompany ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Building2 className="h-4 w-4 mr-2" />}
              {savingCompany ? "Saving..." : editingCompany ? "Save Changes" : "Create Company"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CompaniesPage() {
  return (
    <AuthGate>
      <div className="min-h-[100dvh] flex flex-col">
        <Navbar />
        <CompaniesInner />
      </div>
    </AuthGate>
  );
}
