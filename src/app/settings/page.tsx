"use client";
import { useEffect, useRef, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { Navbar } from "@/components/navbar";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { getClientVisibilitySettings, upsertClientVisibilitySettings, getAutomationSettings, upsertAutomationSettings } from "@/lib/data";
import type { ClientVisibilitySettings, AutomationSettings } from "@/lib/types";

type VisibilityKey = keyof Pick<
  ClientVisibilitySettings,
  | "show_worker_names"
  | "show_estimated_completion"
  | "show_progress_percentage"
  | "show_stage_status"
  | "allow_file_access"
  | "allow_chat"
  | "allow_booking"
>;

interface ToggleRow {
  key: VisibilityKey;
  label: string;
  description: string;
}

const workflowToggles: ToggleRow[] = [
  { key: "show_worker_names", label: "Worker Names", description: "Show assigned worker names on workflow stages" },
  { key: "show_estimated_completion", label: "Estimated Completion", description: "Show estimated completion dates on stages" },
  { key: "show_progress_percentage", label: "Progress Percentage", description: "Show the overall progress bar on the workflow canvas" },
  { key: "show_stage_status", label: "Stage Status Text", description: "Show status text (e.g. 'In Progress') on stages" },
];

const featureToggles: ToggleRow[] = [
  { key: "allow_file_access", label: "File Access", description: "Allow clients to view and download project files" },
  { key: "allow_chat", label: "Chat", description: "Allow clients to send and receive chat messages" },
  { key: "allow_booking", label: "Booking", description: "Allow clients to book calls from the tracking view" },
];

const defaults: Record<VisibilityKey, boolean> = {
  show_worker_names: true,
  show_estimated_completion: true,
  show_progress_percentage: true,
  show_stage_status: true,
  allow_file_access: true,
  allow_chat: true,
  allow_booking: true,
};

type AutomationKey = keyof Pick<
  AutomationSettings,
  | "auto_start_next_stage"
  | "auto_complete_project"
  | "notify_client_stage_complete"
  | "notify_worker_on_assign"
  | "auto_advance_blocked_stages"
>;

interface AutoToggleRow {
  key: AutomationKey;
  label: string;
  description: string;
}

const automationToggles: AutoToggleRow[] = [
  { key: "auto_complete_project", label: "Auto-Complete Project", description: "Mark project as completed when all stages are done" },
  { key: "auto_start_next_stage", label: "Auto-Start Next Stage", description: "When a stage completes, automatically start the next stage by position" },
  { key: "auto_advance_blocked_stages", label: "Auto-Advance Dependencies", description: "When a dependency source completes and all deps are met, start the target stage" },
  { key: "notify_client_stage_complete", label: "Notify Clients on Completion", description: "Email assigned clients when a stage is completed" },
  { key: "notify_worker_on_assign", label: "Notify Worker on Assignment", description: "Email a worker when they are assigned to a stage" },
];

const automationDefaults: Record<AutomationKey, boolean> = {
  auto_start_next_stage: false,
  auto_complete_project: true,
  notify_client_stage_complete: false,
  notify_worker_on_assign: false,
  auto_advance_blocked_stages: false,
};

function SettingsContent() {
  const { orgId, isAdmin } = useAuth();
  const [settings, setSettings] = useState<Record<VisibilityKey, boolean>>(defaults);
  const [autoSettings, setAutoSettings] = useState<Record<AutomationKey, boolean>>(automationDefaults);
  const savedSettings = useRef<Record<VisibilityKey, boolean>>(defaults);
  const savedAutoSettings = useRef<Record<AutomationKey, boolean>>(automationDefaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      try {
        const [visData, autoData] = await Promise.all([
          getClientVisibilitySettings(orgId),
          getAutomationSettings(orgId),
        ]);
        if (visData) {
          const loaded = {
            show_worker_names: visData.show_worker_names,
            show_estimated_completion: visData.show_estimated_completion,
            show_progress_percentage: visData.show_progress_percentage,
            show_stage_status: visData.show_stage_status,
            allow_file_access: visData.allow_file_access,
            allow_chat: visData.allow_chat,
            allow_booking: visData.allow_booking,
          };
          setSettings(loaded);
          savedSettings.current = loaded;
        }
        if (autoData) {
          const loaded = {
            auto_start_next_stage: autoData.auto_start_next_stage,
            auto_complete_project: autoData.auto_complete_project,
            notify_client_stage_complete: autoData.notify_client_stage_complete,
            notify_worker_on_assign: autoData.notify_worker_on_assign,
            auto_advance_blocked_stages: autoData.auto_advance_blocked_stages,
          };
          setAutoSettings(loaded);
          savedAutoSettings.current = loaded;
        }
      } catch {
        // Use defaults
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId]);

  const handleToggle = (key: VisibilityKey) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    try {
      await upsertClientVisibilitySettings({ team_id: orgId, ...settings });
      savedSettings.current = { ...settings };
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAutoToggle = (key: AutomationKey) => {
    setAutoSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveAuto = async () => {
    if (!orgId) return;
    setSavingAuto(true);
    try {
      await upsertAutomationSettings({ team_id: orgId, ...autoSettings });
      savedAutoSettings.current = { ...autoSettings };
      toast.success("Automation settings saved");
    } catch {
      toast.error("Failed to save automation settings");
    } finally {
      setSavingAuto(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Only admins can access settings.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const visibilityDirty = Object.keys(settings).some(
    (k) => settings[k as VisibilityKey] !== savedSettings.current[k as VisibilityKey]
  );
  const automationDirty = Object.keys(autoSettings).some(
    (k) => autoSettings[k as AutomationKey] !== savedAutoSettings.current[k as AutomationKey]
  );

  const renderToggleRow = (row: ToggleRow) => (
    <div key={row.key} className="flex items-center justify-between py-3">
      <div className="space-y-0.5 pr-4">
        <Label htmlFor={row.key} className="text-sm font-medium cursor-pointer">
          {row.label}
        </Label>
        <p className="text-xs text-muted-foreground">{row.description}</p>
      </div>
      <Switch
        id={row.key}
        checked={settings[row.key]}
        onCheckedChange={() => handleToggle(row.key)}
      />
    </div>
  );

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Client Visibility</CardTitle>
          <CardDescription>
            Control what clients can see in the project tracking view.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Workflow Display
          </h3>
          <div className="divide-y">
            {workflowToggles.map(renderToggleRow)}
          </div>

          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-6 mb-2">
            Client Features
          </h3>
          <div className="divide-y">
            {featureToggles.map(renderToggleRow)}
          </div>

          <div className="pt-6">
            <Button onClick={handleSave} disabled={saving || !visibilityDirty}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Automations</CardTitle>
          <CardDescription>
            Automate stage transitions and notifications for your team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="divide-y">
            {automationToggles.map((row) => (
              <div key={row.key} className="flex items-center justify-between py-3">
                <div className="space-y-0.5 pr-4">
                  <Label htmlFor={row.key} className="text-sm font-medium cursor-pointer">
                    {row.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{row.description}</p>
                </div>
                <Switch
                  id={row.key}
                  checked={autoSettings[row.key]}
                  onCheckedChange={() => handleAutoToggle(row.key)}
                />
              </div>
            ))}
          </div>

          <div className="pt-6">
            <Button onClick={handleSaveAuto} disabled={savingAuto || !automationDirty}>
              {savingAuto ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <AuthGate>
      <Navbar />
      <SettingsContent />
    </AuthGate>
  );
}
