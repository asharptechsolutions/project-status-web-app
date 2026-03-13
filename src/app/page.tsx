"use client";
import { useEffect, useState, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getProjects, getAssignedProjects, getClientProjects, getUpcomingAppointments, getStagesForProjects, getCompanies } from "@/lib/data";
import { createClient } from "@/lib/supabase";
import type { Project, ProjectStage, Appointment } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, Clock, CheckCircle2, CalendarDays, AlertTriangle, TrendingUp, ChevronRight, Building2, Plus } from "lucide-react";
import { GettingStartedChecklist } from "@/components/getting-started-checklist";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";
import { toast } from "sonner";

function computeScheduleDays(stageList: ProjectStage[]): number | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const withEstimates = stageList.filter((s) => s.estimated_completion);
  if (withEstimates.length === 0) return null;
  const allCompleted = withEstimates.every((s) => s.status === "completed");
  if (allCompleted) {
    const lastEstimated = [...withEstimates].sort((a, b) =>
      (b.estimated_completion || "").localeCompare(a.estimated_completion || "")
    )[0];
    if (lastEstimated.completed_at) {
      const est = new Date(lastEstimated.estimated_completion + "T00:00:00");
      const completed = new Date(lastEstimated.completed_at);
      completed.setHours(0, 0, 0, 0);
      return Math.round((est.getTime() - completed.getTime()) / (1000 * 60 * 60 * 24));
    }
    return null;
  }
  let worstDays = Infinity;
  for (const s of withEstimates) {
    if (s.status === "completed") continue;
    const est = new Date(s.estimated_completion + "T00:00:00");
    const diff = Math.round((est.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < worstDays) worstDays = diff;
  }
  return worstDays !== Infinity ? worstDays : null;
}

function groupAppointmentsByDay(appts: Appointment[]): { label: string; appointments: Appointment[] }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const groups: Record<string, Appointment[]> = {};
  for (const appt of appts) {
    if (!appt.slot) continue;
    const d = new Date(appt.slot.start_time);
    const key = d.toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(appt);
  }

  return Object.entries(groups).map(([key, dayAppts]) => {
    const d = new Date(key);
    let label: string;
    if (d.toDateString() === today.toDateString()) {
      label = "Today";
    } else if (d.toDateString() === tomorrow.toDateString()) {
      label = "Tomorrow";
    } else {
      label = d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    }
    return { label, appointments: dayAppts };
  });
}

function Dashboard() {
  const { orgId, isAdmin, isWorker, isClient, member } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [companyMap, setCompanyMap] = useState<Record<string, string>>({});
  const [projectProgress, setProjectProgress] = useState<Record<string, number>>({});
  const [projectSchedule, setProjectSchedule] = useState<Record<string, number | null>>({});
  const [upcomingAppts, setUpcomingAppts] = useState<Appointment[]>([]);
  const [checklistDismissed, setChecklistDismissed] = useState(true); // default true to avoid flash

  useEffect(() => {
    if (orgId) {
      setChecklistDismissed(localStorage.getItem(`ps-onboarding-dismissed-${orgId}`) === "true");
    }
  }, [orgId]);

  const dismissChecklist = useCallback(() => {
    if (orgId) localStorage.setItem(`ps-onboarding-dismissed-${orgId}`, "true");
    setChecklistDismissed(true);
  }, [orgId]);

  useEffect(() => {
    if (!orgId) return;
    const load = async () => {
      try {
        const [p, companies] = await Promise.all([
          isClient && member ? getClientProjects(member.id) : getProjects(orgId),
          getCompanies(orgId),
        ]);
        setProjects(p);
        const cMap: Record<string, string> = {};
        companies.forEach((c) => { cMap[c.id] = c.name; });
        setCompanyMap(cMap);

        if (p.length > 0) {
          const allStages = await getStagesForProjects(p.map((proj) => proj.id));
          const progMap: Record<string, number> = {};
          const schedMap: Record<string, number | null> = {};
          for (const proj of p) {
            const projStages = allStages.filter((s) => s.project_id === proj.id);
            const done = projStages.filter((s) => s.status === "completed").length;
            progMap[proj.id] = projStages.length ? Math.round((done / projStages.length) * 100) : 0;
            schedMap[proj.id] = computeScheduleDays(projStages);
          }
          setProjectProgress(progMap);
          setProjectSchedule(schedMap);
        }

        if (isAdmin) {
          setUpcomingAppts(await getUpcomingAppointments(orgId));
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to load projects");
      }
    };
    load();

    if (!isAdmin) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`dashboard-appts:${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "appointments", filter: `team_id=eq.${orgId}` },
        () => { getUpcomingAppointments(orgId).then(setUpcomingAppts).catch(console.error); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId, isClient, isAdmin, member]);

  const active = projects.filter((p) => p.status === "active");
  const completed = projects.filter((p) => p.status === "completed");

  const stats = [
    { icon: FolderOpen, value: projects.length, label: "Total Projects", color: "text-blue-500", bg: "bg-blue-500/10" },
    { icon: Clock, value: active.length, label: "Active", color: "text-amber-500", bg: "bg-amber-500/10" },
    { icon: CheckCircle2, value: completed.length, label: "Completed", color: "text-emerald-500", bg: "bg-emerald-500/10" },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />
      <main className="flex-1 p-4 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Your project overview at a glance</p>
          </div>
          {isAdmin && (
            <Link href="/projects/?new=1">
              <Button className="rounded-full gap-2">
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {stats.map((s, i) => (
            <Card key={s.label} className={`opacity-0 animate-scale-in stagger-${i + 1} overflow-hidden relative group hover:shadow-md transition-shadow`}>
              <CardContent className="pt-6 flex items-center gap-4">
                <div className={`h-12 w-12 rounded-xl ${s.bg} flex items-center justify-center shrink-0`}>
                  <s.icon className={`h-6 w-6 ${s.color}`} />
                </div>
                <div>
                  <p className="text-3xl font-bold tracking-tight">{s.value}</p>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {isAdmin && !checklistDismissed && orgId && (
          <div className="mb-8 opacity-0 animate-fade-up stagger-3">
            <GettingStartedChecklist orgId={orgId} onDismiss={dismissChecklist} />
          </div>
        )}

        {isAdmin && (
          <div className="mb-8 opacity-0 animate-fade-up stagger-3">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CalendarDays className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-lg font-semibold tracking-tight">Upcoming Appointments</h2>
                {upcomingAppts.length > 0 && (
                  <Badge variant="secondary" className="rounded-full">{upcomingAppts.length}</Badge>
                )}
              </div>
              <Link href="/calendar/">
                <Button variant="ghost" size="sm" className="rounded-full text-muted-foreground">View Calendar</Button>
              </Link>
            </div>
            {upcomingAppts.length === 0 ? (
              <Card>
                <CardContent className="pt-6 pb-6 text-center text-muted-foreground text-sm">
                  No upcoming appointments scheduled.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {groupAppointmentsByDay(upcomingAppts).map(({ label, appointments: dayAppts }) => (
                  <div key={label}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
                    <div className="space-y-2">
                      {dayAppts.map((appt) => (
                        <Card key={appt.id} className="hover:shadow-md hover:border-primary/10 transition-all duration-200">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{appt.client_name}</span>
                              {appt.slot && (
                                <span className="text-xs text-muted-foreground font-mono">
                                  {new Date(appt.slot.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                  {" – "}
                                  {new Date(appt.slot.end_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                </span>
                              )}
                            </div>
                            {appt.project_name && (
                              <p className="text-xs text-muted-foreground">{appt.project_name}</p>
                            )}
                            {appt.notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic truncate">{appt.notes}</p>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="opacity-0 animate-fade-up stagger-4">
          <h2 className="text-lg font-semibold tracking-tight mb-3">Active Projects</h2>
          {active.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="No active projects"
              description={isAdmin ? "Create a project to start tracking workflow stages and progress." : "No active projects assigned to you yet."}
              actionLabel={isAdmin ? "Create Project" : undefined}
              onAction={isAdmin ? () => { window.location.href = "/projects/?new=1"; } : undefined}
            />
          ) : (
            <div className="space-y-2">
              {active.map((p) => (
                <Link key={p.id} href={`/projects/?id=${p.id}`}>
                  <Card className="cursor-pointer hover:shadow-md hover:border-primary/10 transition-all duration-200 group">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate group-hover:text-primary transition-colors">{p.name}</p>
                          {p.company_id && companyMap[p.company_id] && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Building2 className="h-3 w-3" /> {companyMap[p.company_id]}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">Created {new Date(p.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <div className="flex items-center gap-2 w-32">
                            <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-primary rounded-full h-1.5 transition-all duration-500"
                                style={{ width: `${projectProgress[p.id] ?? 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground font-medium tabular-nums">{projectProgress[p.id] ?? 0}%</span>
                          </div>
                          {projectSchedule[p.id] != null && (
                            <span className={`text-xs font-medium flex items-center gap-1 ${
                              projectSchedule[p.id]! < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}>
                              {projectSchedule[p.id]! < 0 ? (
                                <><AlertTriangle className="h-3 w-3" />{Math.abs(projectSchedule[p.id]!)}d behind</>
                              ) : projectSchedule[p.id]! === 0 ? (
                                <>On schedule</>
                              ) : (
                                <><TrendingUp className="h-3 w-3" />{projectSchedule[p.id]!}d ahead</>
                              )}
                            </span>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  );
}
