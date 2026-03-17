"use client";

import { useEffect, useState, useCallback } from "react";
import { getActivityLogs, getProjectActivityLogs } from "@/lib/data";
import type { ActivityLog, ActivityAction, ActivityEntityType } from "@/lib/types";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function actionBadgeClass(action: ActivityAction): string {
  switch (action) {
    case "created":
    case "uploaded":
    case "booked":
      return "bg-blue-600/10 text-blue-600 dark:text-blue-400 border-blue-600/20";
    case "completed":
      return "bg-green-600/10 text-green-600 dark:text-green-400 border-green-600/20";
    case "started":
    case "assigned":
      return "bg-amber-600/10 text-amber-600 dark:text-amber-400 border-amber-600/20";
    case "deleted":
    case "cancelled":
      return "bg-red-600/10 text-red-600 dark:text-red-400 border-red-600/20";
    case "archived":
      return "bg-orange-600/10 text-orange-600 dark:text-orange-400 border-orange-600/20";
    case "restored":
      return "bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border-emerald-600/20";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function entityTypeLabel(type: ActivityEntityType): string {
  switch (type) {
    case "preset_stage": return "preset stage";
    case "slack_integration": return "Slack integration";
    default: return type;
  }
}

function describeActivity(log: ActivityLog, showProject: boolean): { main: string; detail: string | null } {
  const entity = entityTypeLabel(log.entity_type);
  const name = log.entity_name ? `"${log.entity_name}"` : "";
  const meta = log.metadata as Record<string, string>;
  const projectCtx = showProject && meta.project_name ? ` in "${meta.project_name}"` : "";

  let main = "";
  let detail: string | null = null;

  switch (log.action) {
    case "invited":
      main = `invited ${meta.role || "member"} ${name || meta.email}`;
      if (meta.email && name) detail = meta.email;
      break;
    case "assigned":
      if (log.entity_type === "stage") {
        main = `assigned ${meta.workerName || meta.assignee_name || "worker"} to stage ${name}${projectCtx}`;
      } else if (log.entity_type === "member") {
        main = `assigned client ${name} to project "${meta.project_name || ""}"`;
      } else {
        main = `assigned ${meta.assignee_name || ""} to ${entity} ${name}${projectCtx}`;
      }
      break;
    case "unassigned":
      if (log.entity_type === "stage") {
        main = `unassigned worker from stage ${name}${projectCtx}`;
      } else if (log.entity_type === "member") {
        main = `removed client ${name} from project "${meta.project_name || ""}"`;
      } else {
        main = `unassigned ${meta.assignee_name || ""} from ${entity} ${name}${projectCtx}`;
      }
      break;
    case "started":
      main = `started stage ${name}${projectCtx}`;
      break;
    case "completed":
      if (log.entity_type === "project") {
        main = `completed project ${name}`;
        if (meta.completedViaAutomation) detail = "Auto-completed (all stages done)";
      } else {
        main = `completed stage ${name}${projectCtx}`;
      }
      break;
    case "created":
      if (log.entity_type === "project") {
        main = `created project ${name}`;
        if (meta.templateUsed) detail = `From template "${meta.templateUsed}"`;
      } else if (log.entity_type === "stage") {
        main = `added stage ${name}${projectCtx}`;
      } else if (log.entity_type === "template") {
        main = `created template ${name}`;
        if (meta.fromProject) detail = `From project "${meta.fromProject}"`;
      } else {
        main = `created ${entity} ${name}`;
      }
      break;
    case "deleted":
      if (log.entity_type === "stage") {
        main = `removed stage ${name}${projectCtx}`;
      } else if (log.entity_type === "member") {
        main = `removed ${meta.role || "member"} ${name}`;
        if (meta.email) detail = meta.email;
      } else {
        main = `deleted ${entity} ${name}`;
      }
      break;
    case "updated":
      if (log.entity_type === "project") {
        main = `updated project ${name}`;
        if (meta.oldName && meta.newName) detail = `Renamed from "${meta.oldName}"`;
      } else if (log.entity_type === "stage") {
        main = `updated stage ${name}${projectCtx}`;
        if (meta.newStatus) detail = `Status → ${meta.newStatus}`;
      } else if (log.entity_type === "member") {
        main = `updated ${meta.role || "member"} ${name}`;
      } else {
        main = `updated ${entity} ${name}`;
      }
      break;
    case "archived":
      main = `archived project ${name}`;
      break;
    case "restored":
      main = `restored project ${name}`;
      if (meta.restoredStatus) detail = `Status → ${meta.restoredStatus}`;
      break;
    default:
      main = `${log.action} ${entity} ${name}${projectCtx}`;
      break;
  }

  return { main: main.trim(), detail };
}

// Export for CSV generation
export function describeActivityPlain(log: ActivityLog): string {
  const { main } = describeActivity(log, true);
  return `${log.actor_name || "Unknown"} ${main}`;
}

interface ActivityFeedProps {
  orgId?: string;
  projectId?: string;
  entityType?: ActivityEntityType;
  actorId?: string;
}

export function ActivityFeed({ orgId, projectId, entityType, actorId }: ActivityFeedProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      if (projectId && !orgId) {
        const result = await getProjectActivityLogs(projectId, PAGE_SIZE, offset);
        setLogs(result.data);
        setCount(result.count);
      } else if (orgId) {
        const result = await getActivityLogs(orgId, {
          limit: PAGE_SIZE,
          offset,
          entityType,
          actorId,
          projectId,
        });
        setLogs(result.data);
        setCount(result.count);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [orgId, projectId, entityType, actorId, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [entityType, actorId, projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Activity className="h-7 w-7 text-muted-foreground/60" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No activity yet</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Actions like creating projects, updating stages, and inviting members will appear here.
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(count / PAGE_SIZE);
  const showProject = !projectId; // Show project context unless already filtered to one project

  return (
    <div>
      <div className="divide-y divide-border">
        {logs.map((log) => {
          const { main, detail } = describeActivity(log, showProject);
          return (
            <div key={log.id} className="flex items-start gap-3 py-3 px-1">
              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{log.actor_name || "Unknown"}</span>{" "}
                  <span className="text-muted-foreground">{main}</span>
                </p>
                {detail && (
                  <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={cn("text-[10px] font-medium capitalize", actionBadgeClass(log.action))}>
                  {log.action}
                </Badge>
                <span className="text-xs text-muted-foreground whitespace-nowrap" title={new Date(log.created_at).toLocaleString()}>
                  {relativeTime(log.created_at)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        totalCount={count}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  );
}
