"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { getWebhooks, createWebhook, updateWebhook, deleteWebhook, getWebhookDeliveries } from "@/lib/data";
import type { Webhook, WebhookDelivery, WebhookEventType } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, Pencil, Send, ChevronDown, ChevronUp, Loader2, Webhook as WebhookIcon, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const EVENT_OPTIONS: { value: WebhookEventType; label: string }[] = [
  { value: "stage_completed", label: "Stage Completed" },
  { value: "stage_started", label: "Stage Started" },
  { value: "project_created", label: "Project Created" },
  { value: "project_completed", label: "Project Completed" },
  { value: "client_added", label: "Client Added" },
  { value: "member_invited", label: "Member Invited" },
];

export function WebhookSettings() {
  const { orgId } = useAuth();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Webhook | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Webhook | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Record<string, WebhookDelivery[]>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formEvents, setFormEvents] = useState<WebhookEventType[]>([]);
  const [formActive, setFormActive] = useState(true);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const data = await getWebhooks(orgId);
      setWebhooks(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setFormName("");
    setFormUrl("");
    setFormSecret("");
    setFormEvents([]);
    setFormActive(true);
    setEditing(null);
  };

  const openAdd = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (wh: Webhook) => {
    setEditing(wh);
    setFormName(wh.name);
    setFormUrl(wh.url);
    setFormSecret("");
    setFormEvents(wh.events);
    setFormActive(wh.is_active);
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!orgId) return;
    if (!formUrl.trim()) { toast.error("URL is required"); return; }
    if (formEvents.length === 0) { toast.error("Select at least one event"); return; }

    setSaving(true);
    try {
      if (editing) {
        const updates: Partial<Webhook> = {
          name: formName.trim(),
          url: formUrl.trim(),
          events: formEvents,
          is_active: formActive,
        };
        if (formSecret.trim()) updates.secret = formSecret.trim();
        await updateWebhook(editing.id, updates);
        toast.success("Webhook updated");
      } else {
        await createWebhook({
          team_id: orgId,
          name: formName.trim() || "Webhook",
          url: formUrl.trim(),
          secret: formSecret.trim() || null,
          events: formEvents,
          is_active: formActive,
        });
        toast.success("Webhook created");
      }
      setShowDialog(false);
      resetForm();
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save webhook");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteWebhook(deleteTarget.id);
      toast.success("Webhook deleted");
      setDeleteTarget(null);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete webhook");
    }
  };

  const handleToggleActive = async (wh: Webhook) => {
    try {
      await updateWebhook(wh.id, { is_active: !wh.is_active });
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update webhook");
    }
  };

  const handleTest = async (wh: Webhook) => {
    setTesting(wh.id);
    try {
      const res = await fetch("/api/webhooks/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webhookId: wh.id, teamId: wh.team_id }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Test delivered — HTTP ${data.status_code}`);
      } else {
        toast.error(data.error || "Test delivery failed");
      }
    } catch {
      toast.error("Failed to send test");
    } finally {
      setTesting(null);
    }
  };

  const toggleExpand = async (whId: string) => {
    if (expandedId === whId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(whId);
    if (!deliveries[whId]) {
      try {
        const data = await getWebhookDeliveries(whId);
        setDeliveries((prev) => ({ ...prev, [whId]: data }));
      } catch {
        // silent
      }
    }
  };

  const toggleEvent = (event: WebhookEventType) => {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <WebhookIcon className="h-5 w-5" />
                Outgoing Webhooks
              </CardTitle>
              <CardDescription>
                Send event notifications to external services when things happen in your projects.
              </CardDescription>
            </div>
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {webhooks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No webhooks configured. Add one to start receiving event notifications.
            </p>
          ) : (
            <div className="space-y-3">
              {webhooks.map((wh) => (
                <div key={wh.id} className="border rounded-lg">
                  <div className="flex items-center gap-3 p-3">
                    <Switch
                      checked={wh.is_active}
                      onCheckedChange={() => handleToggleActive(wh)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{wh.name || "Webhook"}</p>
                      <p className="text-xs text-muted-foreground truncate">{wh.url}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {wh.events.map((e) => (
                          <Badge key={e} variant="secondary" className="text-[10px]">
                            {e.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleTest(wh)} disabled={testing === wh.id}>
                        {testing === wh.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(wh)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(wh)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleExpand(wh.id)}>
                        {expandedId === wh.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Delivery log */}
                  {expandedId === wh.id && (
                    <div className="border-t px-3 py-2 bg-muted/30">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Recent Deliveries</p>
                      {!deliveries[wh.id] ? (
                        <Loader2 className="h-4 w-4 animate-spin mx-auto my-4" />
                      ) : deliveries[wh.id].length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">No deliveries yet</p>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {deliveries[wh.id].map((d) => (
                            <div key={d.id} className="flex items-center gap-2 text-xs">
                              {d.success ? (
                                <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                              ) : (
                                <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                              )}
                              <span className="text-muted-foreground">
                                {d.event_type.replace(/_/g, " ")}
                              </span>
                              <span className="text-muted-foreground">
                                {d.status_code ? `HTTP ${d.status_code}` : "failed"}
                              </span>
                              <span className="ml-auto text-muted-foreground">
                                {new Date(d.created_at).toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Webhook" : "Add Webhook"}</DialogTitle>
            <DialogDescription>
              Configure an endpoint to receive event notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="wh-name">Name</Label>
              <Input id="wh-name" placeholder="My Webhook" value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="wh-url">URL</Label>
              <Input id="wh-url" placeholder="https://example.com/webhook" value={formUrl} onChange={(e) => setFormUrl(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="wh-secret">
                Signing Secret <span className="text-muted-foreground text-xs">(optional)</span>
              </Label>
              <Input id="wh-secret" placeholder={editing ? "Leave blank to keep existing" : "HMAC-SHA256 signing secret"} value={formSecret} onChange={(e) => setFormSecret(e.target.value)} />
            </div>
            <div>
              <Label>Events</Label>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                {EVENT_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-input"
                      checked={formEvents.includes(opt.value)}
                      onChange={() => toggleEvent(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="wh-active">Active</Label>
              <Switch id="wh-active" checked={formActive} onCheckedChange={setFormActive} />
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Update Webhook" : "Create Webhook"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deleteTarget?.name}&quot; and all its delivery history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
