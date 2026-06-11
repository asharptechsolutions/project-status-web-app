"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getTeamStages, getTeamTimeEntries, getMembers } from "@/lib/data";
import type { ProjectStage, TimeEntry, Member } from "@/lib/types";
import {
  throughputByWeek, cycleTimeByStage, onTimeDelivery, utilizationByWorker, capacityByWorker,
} from "@/lib/analytics";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, Clock, Gauge, Users, AlertTriangle, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from "recharts";

function StatTile({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
            {sub && <p className="text-xs text-muted-foreground/80">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyticsInner() {
  const { orgId, isAdmin } = useAuth();
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const [s, t, m] = await Promise.all([
        getTeamStages(orgId),
        getTeamTimeEntries(orgId).catch(() => [] as TimeEntry[]),
        getMembers(orgId).catch(() => [] as Member[]),
      ]);
      setStages(s);
      setEntries(t);
      setMembers(m);
    } catch {
      // surfaced as empty charts
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const throughput = useMemo(() => throughputByWeek(stages), [stages]);
  const cycle = useMemo(() => cycleTimeByStage(stages).slice(0, 8), [stages]);
  const onTime = useMemo(() => onTimeDelivery(stages), [stages]);
  const utilization = useMemo(() => utilizationByWorker(entries, members), [entries, members]);
  const capacity = useMemo(() => capacityByWorker(stages, members), [stages, members]);

  const completedTotal = useMemo(() => stages.filter((s) => s.status === "completed").length, [stages]);
  const activeTotal = useMemo(() => stages.filter((s) => s.status === "in_progress").length, [stages]);
  const last4 = throughput.slice(-4).reduce((a, p) => a + p.completed, 0);

  if (!isAdmin) {
    return <div className="p-8 text-center text-muted-foreground">Only admins can view analytics.</div>;
  }
  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const hasHistory = completedTotal > 0;

  return (
    <div className="p-4 max-w-6xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6" /> Shop Analytics</h1>
        <p className="text-sm text-muted-foreground">Throughput, cycle times, and capacity from your own production history.</p>
      </div>

      {!hasHistory ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            Analytics will populate as you complete stages. Finish a few stages to see throughput and cycle-time trends.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Stat tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile icon={TrendingUp} label="Stages completed (4 wks)" value={String(last4)} />
            <StatTile icon={Gauge} label="On-time rate" value={onTime.total ? `${Math.round(onTime.rate * 100)}%` : "—"} sub={onTime.total ? `${onTime.onTime}/${onTime.total} stages` : "no estimates yet"} />
            <StatTile icon={Clock} label="Active stages now" value={String(activeTotal)} />
            <StatTile icon={BarChart3} label="Total completed" value={String(completedTotal)} />
          </div>

          {/* Throughput */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Throughput</CardTitle>
              <CardDescription>Stages completed per week (last 12 weeks)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={throughput} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="completed" name="Completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cycle time / bottlenecks */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" /> Bottlenecks
              </CardTitle>
              <CardDescription>Average days per stage — your slowest steps first</CardDescription>
            </CardHeader>
            <CardContent>
              {cycle.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not enough completed stages yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(180, cycle.length * 36)}>
                  <BarChart layout="vertical" data={cycle} margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={120} fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(value) => [`${value} days`, "Avg cycle"]}
                    />
                    <Bar dataKey="avgDays" radius={[0, 4, 4, 0]}>
                      {cycle.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? "hsl(var(--destructive))" : "hsl(var(--primary))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Capacity + utilization */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Current workload</CardTitle>
                <CardDescription>Open stages assigned per worker</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {capacity.filter((c) => c.inProgress + c.queued > 0).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No open assigned stages.</p>
                ) : (
                  capacity.filter((c) => c.inProgress + c.queued > 0).map((c) => (
                    <div key={c.userId} className="flex items-center justify-between text-sm">
                      <span className="truncate">{c.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {c.inProgress > 0 && <Badge className="bg-blue-600 text-white hover:bg-blue-700">{c.inProgress} active</Badge>}
                        {c.queued > 0 && <Badge variant="secondary">{c.queued} queued</Badge>}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Logged hours</CardTitle>
                <CardDescription>Time tracked per worker (billable shown)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {utilization.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No time entries logged yet.</p>
                ) : (
                  utilization.map((u) => (
                    <div key={u.userId} className="flex items-center justify-between text-sm">
                      <span className="truncate">{u.name}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {u.loggedHours}h{u.billableHours > 0 && <span className="text-green-600 dark:text-green-400"> · {u.billableHours}h billable</span>}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <AuthGate>
      <div className="min-h-[100dvh] flex flex-col">
        <Navbar />
        <AnalyticsInner />
      </div>
    </AuthGate>
  );
}
