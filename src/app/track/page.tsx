"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { Project, ProjectStage } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Workflow, CheckCircle2, Clock, Loader2 } from "lucide-react";

function TrackInner() {
  const searchParams = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) { setError("No project ID provided."); setLoading(false); return; }

    (async () => {
      try {
        const { data: proj } = await createClient().from("projects").select("*").eq("id", id).single();
        if (!proj) { setError("Project not found."); setLoading(false); return; }
        setProject(proj as Project);

        const { data: stgs } = await createClient().from("project_stages").select("*").eq("project_id", id).order("position");
        setStages((stgs || []) as ProjectStage[]);
      } catch {
        setError("Failed to load project.");
      } finally {
        setLoading(false);
      }
    })();
  }, [searchParams]);

  if (loading) return <div className="flex items-center justify-center min-h-[100dvh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (error) return <div className="flex items-center justify-center min-h-[100dvh] p-4"><Card><CardContent className="pt-6 text-center text-muted-foreground">{error}</CardContent></Card></div>;
  if (!project) return null;

  const completedCount = stages.filter((s) => s.status === "completed").length;
  const progress = stages.length ? Math.round((completedCount / stages.length) * 100) : 0;

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b py-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          <Workflow className="h-5 w-5 text-primary" />
          <span className="font-bold">ProjectStatus</span>
        </div>
      </header>

      <main className="p-4 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && <p className="text-muted-foreground mt-1">{project.description}</p>}
        </div>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">Overall Progress</span>
              <Badge variant={project.status === "completed" ? "default" : "secondary"}>{progress}%</Badge>
            </div>
            <div className="w-full bg-secondary rounded-full h-4">
              <div className="bg-primary rounded-full h-4 transition-all flex items-center justify-center" style={{ width: `${Math.max(progress, 5)}%` }}>
                {progress > 15 && <span className="text-[10px] text-primary-foreground font-bold">{progress}%</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        <h2 className="text-lg font-semibold mb-3">Workflow Stages</h2>
        <div className="space-y-3">
          {stages.map((stage) => (
            <Card key={stage.id}>
              <CardContent className="pt-4 pb-4 flex items-center gap-3">
                {stage.status === "completed" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                {stage.status === "in_progress" && <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />}
                {stage.status === "pending" && <Clock className="h-5 w-5 text-muted-foreground" />}
                <div className="flex-1">
                  <p className="font-medium">{stage.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{stage.status.replace("_", " ")}</p>
                </div>
                <Badge variant={stage.status === "completed" ? "default" : stage.status === "in_progress" ? "secondary" : "outline"} className="capitalize">
                  {stage.status.replace("_", " ")}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <footer className="border-t py-4 px-4 mt-8">
        <p className="text-center text-sm text-muted-foreground">Powered by ProjectStatus</p>
      </footer>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[100dvh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
      <TrackInner />
    </Suspense>
  );
}
