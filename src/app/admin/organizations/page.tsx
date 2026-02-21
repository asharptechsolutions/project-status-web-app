"use client";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Building2, Pencil, Trash2, Users, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import type { AdminOrganization } from "@/lib/types";

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<AdminOrganization[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit dialog
  const [editOrg, setEditOrg] = useState<AdminOrganization | null>(null);
  const [editName, setEditName] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/organizations/");
      if (!res.ok) throw new Error("Failed to load organizations");
      setOrgs(await res.json());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (org: AdminOrganization) => {
    setEditOrg(org);
    setEditName(org.name);
  };

  const handleUpdate = async () => {
    if (!editOrg || !editName.trim()) return;
    try {
      const res = await fetch(`/api/admin/organizations/${editOrg.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }
      setEditOrg(null);
      toast.success("Organization updated");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (org: AdminOrganization) => {
    try {
      const res = await fetch(`/api/admin/organizations/${org.id}/`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      toast.success("Organization deleted");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Organizations</h1>

      {orgs.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No organizations yet.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {orgs.map((org) => (
            <Card key={org.id}>
              <CardContent className="pt-4 pb-4 flex items-center gap-4">
                <Building2 className="h-10 w-10 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{org.name}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {org.memberCount} {org.memberCount === 1 ? "member" : "members"}
                    </span>
                    <span className="flex items-center gap-1">
                      <FolderOpen className="h-3.5 w-3.5" />
                      {org.projectCount} {org.projectCount === 1 ? "project" : "projects"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Created {new Date(org.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(org)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Organization</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete &quot;{org.name}&quot; and all its projects, members, and data. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(org)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editOrg} onOpenChange={(open) => { if (!open) setEditOrg(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Organization</DialogTitle>
            <DialogDescription>Update the organization name</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && editName.trim()) {
                    e.preventDefault();
                    handleUpdate();
                  }
                }}
              />
            </div>
            <Button onClick={handleUpdate} className="w-full" disabled={!editName.trim()}>
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
