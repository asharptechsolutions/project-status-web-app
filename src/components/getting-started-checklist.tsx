"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, ChevronRight, X, Rocket } from "lucide-react";
import { getProjects, getStagesForProjects, getMembers, getAvailabilitySlots } from "@/lib/data";
import Link from "next/link";

interface ChecklistProps {
  orgId: string;
  onDismiss: () => void;
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  done: boolean;
  href: string;
}

export function GettingStartedChecklist({ orgId, onDismiss }: ChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [projects, members] = await Promise.all([
        getProjects(orgId),
        getMembers(orgId),
      ]);

      // Check stages if projects exist
      let hasMultipleStages = false;
      if (projects.length > 0) {
        const stages = await getStagesForProjects(projects.map((p) => p.id));
        hasMultipleStages = projects.some(
          (p) => stages.filter((s) => s.project_id === p.id).length > 1
        );
      }

      const hasWorkers = members.some((m) => m.role === "worker");
      const hasClients = members.some((m) => m.role === "client");

      // Check calendar slots
      let hasSlots = false;
      try {
        const now = new Date();
        const future = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        const slots = await getAvailabilitySlots(orgId, now.toISOString(), future.toISOString());
        hasSlots = slots.length > 0;
      } catch {
        // Calendar may not be set up
      }

      setItems([
        {
          id: "project",
          label: "Create your first project",
          description: "Define workflows and track progress",
          done: projects.length > 0,
          href: "/projects/?new=1",
        },
        {
          id: "stages",
          label: "Add workflow stages",
          description: "Break projects into trackable steps",
          done: hasMultipleStages,
          href: "/projects/",
        },
        {
          id: "worker",
          label: "Invite a team member",
          description: "Workers progress stages forward",
          done: hasWorkers,
          href: "/crm/workers/",
        },
        {
          id: "client",
          label: "Add a client",
          description: "Clients see real-time project status",
          done: hasClients,
          href: "/crm/clients/",
        },
        {
          id: "calendar",
          label: "Set up your calendar",
          description: "Let clients book time with you",
          done: hasSlots,
          href: "/calendar/",
        },
      ]);
    } catch {
      // Fail silently — checklist is non-critical
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return null;

  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const allDone = completed === total;

  if (allDone) return null;

  return (
    <Card className="shadow-sm border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Rocket className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Getting Started</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {completed} of {total} complete
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-3 bg-secondary rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-primary rounded-full h-1.5 transition-all duration-500"
            style={{ width: `${(completed / total) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-4">
        <div className="space-y-1">
          {items.map((item) => (
            <Link key={item.id} href={item.href}>
              <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors group">
                {item.done ? (
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.done ? "line-through text-muted-foreground" : ""}`}>
                    {item.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                {!item.done && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                )}
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
