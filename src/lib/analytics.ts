import type { ProjectStage, TimeEntry, Member } from "./types";

// Pure analytics over stage history + time entries. Powers the /analytics
// dashboard. All durations in milliseconds unless noted.

const DAY_MS = 24 * 60 * 60 * 1000;

function normName(name: string): string {
  return name.trim().toLowerCase();
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay()); // back to Sunday
  return x;
}

export interface ThroughputPoint {
  weekStart: string; // ISO date
  label: string;     // "Jun 8"
  completed: number;
}

/** Stages completed per week over the last `weeks` weeks. */
export function throughputByWeek(stages: ProjectStage[], weeks = 12): ThroughputPoint[] {
  const now = new Date();
  const buckets = new Map<string, number>();
  const points: ThroughputPoint[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = startOfWeek(new Date(now.getTime() - i * 7 * DAY_MS));
    const key = ws.toISOString().slice(0, 10);
    buckets.set(key, 0);
    points.push({ weekStart: key, label: ws.toLocaleDateString(undefined, { month: "short", day: "numeric" }), completed: 0 });
  }
  for (const s of stages) {
    if (s.status !== "completed" || !s.completed_at) continue;
    const key = startOfWeek(new Date(s.completed_at)).toISOString().slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return points.map((p) => ({ ...p, completed: buckets.get(p.weekStart) || 0 }));
}

export interface CycleTimeRow {
  name: string;
  avgDays: number;
  samples: number;
}

/** Average cycle time (days) per stage name, slowest first. */
export function cycleTimeByStage(stages: ProjectStage[]): CycleTimeRow[] {
  const buckets = new Map<string, { total: number; count: number; display: string }>();
  for (const s of stages) {
    if (s.status !== "completed" || !s.started_at || !s.completed_at) continue;
    const ms = new Date(s.completed_at).getTime() - new Date(s.started_at).getTime();
    if (ms <= 0 || ms > 365 * DAY_MS) continue;
    const key = normName(s.name);
    const b = buckets.get(key) || { total: 0, count: 0, display: s.name };
    b.total += ms;
    b.count += 1;
    buckets.set(key, b);
  }
  return [...buckets.values()]
    .map((b) => ({ name: b.display, avgDays: +(b.total / b.count / DAY_MS).toFixed(1), samples: b.count }))
    .sort((a, b) => b.avgDays - a.avgDays);
}

export interface OnTimeStats {
  total: number;
  onTime: number;
  rate: number; // 0–1
}

/** Of completed stages that had an estimate, how many finished on or before it. */
export function onTimeDelivery(stages: ProjectStage[]): OnTimeStats {
  let total = 0;
  let onTime = 0;
  for (const s of stages) {
    if (s.status !== "completed" || !s.completed_at || !s.estimated_completion) continue;
    total++;
    const due = new Date(s.estimated_completion + "T23:59:59").getTime();
    if (new Date(s.completed_at).getTime() <= due) onTime++;
  }
  return { total, onTime, rate: total ? onTime / total : 0 };
}

export interface UtilizationRow {
  userId: string;
  name: string;
  loggedHours: number;
  billableHours: number;
}

/** Hours logged per worker from time entries. */
export function utilizationByWorker(entries: TimeEntry[], members: Member[]): UtilizationRow[] {
  const nameOf = new Map(members.map((m) => [m.user_id, m.name || m.email]));
  const buckets = new Map<string, { logged: number; billable: number }>();
  for (const e of entries) {
    const mins = e.duration_minutes || 0;
    if (mins <= 0) continue;
    const b = buckets.get(e.user_id) || { logged: 0, billable: 0 };
    b.logged += mins;
    if (e.billable) b.billable += mins;
    buckets.set(e.user_id, b);
  }
  return [...buckets.entries()]
    .map(([userId, b]) => ({
      userId,
      name: nameOf.get(userId) || "Unknown",
      loggedHours: +(b.logged / 60).toFixed(1),
      billableHours: +(b.billable / 60).toFixed(1),
    }))
    .sort((a, b) => b.loggedHours - a.loggedHours);
}

export interface CapacityRow {
  userId: string;
  name: string;
  inProgress: number;
  queued: number;
}

/** Per-worker open workload: active + queued stages assigned to them. */
export function capacityByWorker(stages: ProjectStage[], members: Member[]): CapacityRow[] {
  const workers = members.filter((m) => m.role === "owner" || m.role === "admin" || m.role === "worker");
  const rows = new Map<string, CapacityRow>();
  for (const w of workers) {
    rows.set(w.user_id, { userId: w.user_id, name: w.name || w.email, inProgress: 0, queued: 0 });
  }
  for (const s of stages) {
    if (!s.assigned_to || s.status === "completed") continue;
    const row = rows.get(s.assigned_to);
    if (!row) continue;
    if (s.status === "in_progress") row.inProgress++;
    else row.queued++;
  }
  return [...rows.values()].sort((a, b) => (b.inProgress + b.queued) - (a.inProgress + a.queued));
}
