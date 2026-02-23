"use client";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getProjects, getAssignedProjects, getClientProjects, getUpcomingAppointments, getStagesForProjects, getCompanies } from "@/lib/data";
import { createClient } from "@/lib/supabase";
import type { Project, ProjectStage, Appointment } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, Clock, CheckCircle2, CalendarDays, AlertTriangle, TrendingUp, ChevronRight, Building2 } from "lucide-react";
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

        // Compute progress and schedule per project
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

    // Realtime for appointments (admin only)
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

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />
      <main className="flex-1 p-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          {isAdmin && (
            <Link href="/projects/?new=1">
              <Button>New Project</Button>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <FolderOpen className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{projects.length}</p>
                <p className="text-sm text-muted-foreground">Total Projects</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{active.length}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{completed.length}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {isAdmin && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Upcoming Appointments</h2>
                {upcomingAppts.length > 0 && (
                  <Badge variant="secondary">{upcomingAppts.length}</Badge>
                )}
              </div>
              <Link href="/calendar/">
                <Button variant="ghost" size="sm">View Calendar</Button>
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
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{label}</p>
                    <div className="space-y-3">
                      {dayAppts.map((appt) => (
                        <Card key={appt.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="pt-4 pb-4">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{appt.client_name}</span>
                              {appt.slot && (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(appt.slot.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                  {" - "}
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

        <h2 className="text-lg font-semibold mb-3">Active Projects</h2>
        {active.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              {isAdmin ? "No active projects. Create one to get started!" : "No active projects assigned to you."}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {active.map((p) => (
              <Link key={p.id} href={`/projects/?id=${p.id}`}>
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{p.name}</p>
                        {p.company_id && companyMap[p.company_id] && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> {companyMap[p.company_id]}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">Created {new Date(p.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center gap-2 w-32">
                          <div className="flex-1 bg-secondary rounded-full h-2">
                            <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${projectProgress[p.id] ?? 0}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground font-medium">{projectProgress[p.id] ?? 0}%</span>
                        </div>
                        {projectSchedule[p.id] != null && (
                          <span className={`text-xs font-medium flex items-center gap-1 ${
                            projectSchedule[p.id]! < 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-green-600 dark:text-green-400"
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
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
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
