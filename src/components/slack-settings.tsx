"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { getSlackIntegration, upsertSlackIntegration, deleteSlackIntegration } from "@/lib/data";
import type { SlackIntegration, WebhookEventType } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, Save, Trash2, Send, MessageSquare, ExternalLink, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const EVENT_OPTIONS: { value: WebhookEventType; label: string }[] = [
  { value: "stage_completed", label: "Stage Completed" },
  { value: "stage_started", label: "Stage Started" },
  { value: "project_created", label: "Project Created" },
  { value: "project_completed", label: "Project Completed" },
  { value: "client_added", label: "Client Added" },
  { value: "member_invited", label: "Member Invited" },
];

export function SlackSettings() {
  const { orgId } = useAuth();
  const [integration, setIntegration] = useState<SlackIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);

  // Form state
  const [webhookUrl, setWebhookUrl] = useState("");
  const [channelName, setChannelName] = useState("");
  const [events, setEvents] = useState<WebhookEventType[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const data = await getSlackIntegration(orgId);
      setIntegration(data);
      if (data) {
        setWebhookUrl(data.webhook_url);
        setChannelName(data.channel_name || "");
        setEvents(data.events);
        setIsActive(data.is_active);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load Slack integration");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!orgId) return;
    if (!webhookUrl.trim()) { toast.error("Webhook URL is required"); return; }
    if (!webhookUrl.startsWith("https://hooks.slack.com/")) {
      toast.error("URL must start with https://hooks.slack.com/");
      return;
    }
    if (events.length === 0) { toast.error("Select at least one event"); return; }

    setSaving(true);
    try {
      await upsertSlackIntegration({
        team_id: orgId,
        webhook_url: webhookUrl.trim(),
        channel_name: channelName.trim() || null,
        events,
        is_active: isActive,
      });
      toast.success("Slack integration saved");
      setDirty(false);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!orgId) return;
    try {
      await deleteSlackIntegration(orgId);
      toast.success("Slack disconnected");
      setIntegration(null);
      setWebhookUrl("");
      setChannelName("");
      setEvents([]);
      setIsActive(true);
      setDirty(false);
      setShowDisconnect(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect");
    }
  };

  const handleTest = async () => {
    if (!orgId) return;
    setTesting(true);
    try {
      const res = await fetch("/api/slack/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: orgId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Test message sent to Slack");
      } else {
        toast.error(data.error || "Failed to send test message");
      }
    } catch {
      toast.error("Failed to send test");
    } finally {
      setTesting(false);
    }
  };

  const toggleEvent = (event: WebhookEventType) => {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
    setDirty(true);
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
                <MessageSquare className="h-5 w-5" />
                Slack Integration
              </CardTitle>
              <CardDescription>
                Send project notifications to a Slack channel.
              </CardDescription>
            </div>
            {integration && (
              <div className="flex items-center gap-2">
                <Badge variant={integration.is_active ? "default" : "secondary"}>
                  {integration.is_active ? "Connected" : "Paused"}
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!integration && !webhookUrl ? (
            <div className="text-center py-6 space-y-3">
              <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto" />
              <div>
                <p className="text-sm font-medium">Connect Slack</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create a Slack Incoming Webhook in your workspace, then paste the URL below.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                  How to create a Slack webhook
                </a>
              </Button>
            </div>
          ) : null}

          <div>
            <Label htmlFor="slack-url">Webhook URL</Label>
            <Input
              id="slack-url"
              placeholder="https://hooks.slack.com/services/T.../B.../..."
              value={webhookUrl}
              onChange={(e) => { setWebhookUrl(e.target.value); setDirty(true); }}
            />
          </div>

          <div>
            <Label htmlFor="slack-channel">
              Channel Name <span className="text-muted-foreground text-xs">(for display)</span>
            </Label>
            <Input
              id="slack-channel"
              placeholder="#project-updates"
              value={channelName}
              onChange={(e) => { setChannelName(e.target.value); setDirty(true); }}
            />
          </div>

          <div>
            <Label>Events</Label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              {EVENT_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-input"
                    checked={events.includes(opt.value)}
                    onChange={() => toggleEvent(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="slack-active">Active</Label>
            <Switch
              id="slack-active"
              checked={isActive}
              onCheckedChange={(v) => { setIsActive(v); setDirty(true); }}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving || (!dirty && !!integration)}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {integration ? "Save Changes" : "Connect"}
            </Button>
            {integration && (
              <>
                <Button variant="outline" onClick={handleTest} disabled={testing}>
                  {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  Test
                </Button>
                <Button variant="ghost" className="text-destructive ml-auto" onClick={() => setShowDisconnect(true)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Disconnect
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Disconnect confirmation */}
      <AlertDialog open={showDisconnect} onOpenChange={setShowDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Slack</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the Slack integration. Notifications will no longer be sent to Slack.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Badge({ variant, children }: { variant: "default" | "secondary"; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
      variant === "default"
        ? "bg-green-500/10 text-green-600 dark:text-green-400"
        : "bg-muted text-muted-foreground"
    }`}>
      {variant === "default" && <CheckCircle2 className="h-3 w-3" />}
      {children}
    </span>
  );
}
