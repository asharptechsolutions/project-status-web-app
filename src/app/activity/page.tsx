"use client";
import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getMembers, getProjects, getActivityLogs } from "@/lib/data";
import type { Member, Project, ActivityEntityType, ActivityLog } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Activity, X, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { ActivityFeed, describeActivityPlain } from "@/components/activity-feed";
import { generateCsv, downloadCsv } from "@/lib/csv";

const ENTITY_TYPE_OPTIONS: { value: ActivityEntityType; label: string }[] = [
  { value: "project", label: "Projects" },
  { value: "stage", label: "Stages" },
  { value: "member", label: "Members" },
  { value: "company", label: "Companies" },
  { value: "template", label: "Templates" },
  { value: "appointment", label: "Appointments" },
  { value: "file", label: "Files" },
  { value: "settings", label: "Settings" },
  { value: "webhook", label: "Webhooks" },
];

function ActivityInner() {
  const { orgId, isAdmin } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filters
  const [entityType, setEntityType] = useState<ActivityEntityType | undefined>();
  const [actorId, setActorId] = useState<string | undefined>();
  const [projectId, setProjectId] = useState<string | undefined>();

  const hasFilters = entityType || actorId || projectId;

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const [m, p] = await Promise.all([getMembers(orgId), getProjects(orgId)]);
      setMembers(m);
      setProjects(p);
    } catch (err: any) {
      toast.error(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = async () => {
    if (!orgId) return;
    setExporting(true);
    try {
      // Fetch all logs matching current filters (up to 1000)
      const result = await getActivityLogs(orgId, {
        limit: 1000,
        offset: 0,
        entityType,
        actorId,
        projectId,
      });

      if (result.data.length === 0) {
        toast.error("No activity to export");
        return;
      }

      const columns = [
        { key: "timestamp", header: "Timestamp" },
        { key: "actor", header: "User" },
        { key: "action", header: "Action" },
        { key: "type", header: "Entity Type" },
        { key: "entity", header: "Entity Name" },
        { key: "project", header: "Project" },
        { key: "description", header: "Description" },
      ];

      const rows = result.data.map((log) => ({
        timestamp: new Date(log.created_at).toLocaleString(),
        actor: log.actor_name || "Unknown",
        action: log.action,
        type: log.entity_type,
        entity: log.entity_name || "",
        project: (log.metadata as Record<string, string>)?.project_name || "",
        description: describeActivityPlain(log),
      }));

      const csv = generateCsv(columns, rows);
      downloadCsv(csv, `activity-log-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(`Exported ${rows.length} activity entries`);
    } catch (err: any) {
      toast.error(err.message || "Failed to export");
    } finally {
      setExporting(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Activity className="h-10 w-10 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold">Access Denied</h2>
        <p className="text-sm text-muted-foreground mt-1">Only admins can view the activity log.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const teamMembers = members.filter((m) => m.role === "owner" || m.role === "admin" || m.role === "worker");

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
          <p className="text-sm text-muted-foreground mt-1">Track who did what and when across your organization.</p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
          Export
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={entityType || ""}
          onValueChange={(v) => setEntityType(v as ActivityEntityType || undefined)}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={actorId || ""}
          onValueChange={(v) => setActorId(v || undefined)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All members" />
          </SelectTrigger>
          <SelectContent>
            {teamMembers.map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>{m.name || m.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={projectId || ""}
          onValueChange={(v) => setProjectId(v || undefined)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setEntityType(undefined); setActorId(undefined); setProjectId(undefined); }}
            className="text-muted-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Activity Feed */}
      <Card>
        <CardContent className="p-4">
          <ActivityFeed
            orgId={orgId!}
            entityType={entityType}
            actorId={actorId}
            projectId={projectId}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function ActivityPage() {
  return (
    <AuthGate>
      <Navbar />
      <ActivityInner />
    </AuthGate>
  );
}
