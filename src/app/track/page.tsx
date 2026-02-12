"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getProjectByToken } from "@/lib/firestore";
import type { Project } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Circle, Workflow } from "lucide-react";

function TrackInner() {
  const searchParams = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) { setError("No tracking token provided."); setLoading(false); return; }
    getProjectByToken(token).then((p) => {
      if (!p) setError("Project not found. The link may be invalid.");
      else setProject(p);
      setLoading(false);
    }).catch((err) => { setError(err.message || "Failed to load project."); setLoading(false); });
  }, [searchParams]);

  if (loading) return <div className="flex items-center justify-center min-h-[100dvh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (error) return <div className="flex items-center justify-center min-h-[100dvh] p-4"><Card className="max-w-md w-full"><CardContent className="pt-6 text-center"><p className="text-lg font-medium mb-2">Oops!</p><p className="text-muted-foreground">{error}</p></CardContent></Card></div>;
  if (!project) return null;

  const progress = project.nodes.length ? Math.round((project.nodes.filter((n) => n.status === "completed").length / project.nodes.length) * 100) : 0;
  const currentNode = project.nodes.find((n) => n.status === "in-progress");

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b py-4 px-4">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <Workflow className="h-5 w-5 text-primary" />
          <span className="font-bold">Workflowz</span>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground">Client: {project.clientName}</p>
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
            {currentNode && (
              <p className="mt-3 text-sm text-muted-foreground">Currently at: <strong className="text-foreground">{currentNode.label}</strong></p>
            )}
            {project.status === "completed" && (
              <p className="mt-3 text-sm text-green-600 dark:text-green-400 font-medium">✅ Project completed!</p>
            )}
          </CardContent>
        </Card>

        <h2 className="text-lg font-semibold mb-3">Workflow Stages</h2>
        <div className="space-y-3">
          {project.nodes.map((node, i) => (
            <div key={node.id} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                {node.status === "completed" ? (
                  <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                ) : node.status === "in-progress" ? (
                  <Clock className="h-6 w-6 text-blue-500 animate-pulse shrink-0" />
                ) : (
                  <Circle className="h-6 w-6 text-muted-foreground shrink-0" />
                )}
                {i < project.nodes.length - 1 && <div className="w-0.5 h-8 bg-border mt-1" />}
              </div>
              <div className="pb-4">
                <p className={`font-medium ${node.status === "completed" ? "text-green-600 dark:text-green-400" : node.status === "in-progress" ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}>
                  {node.label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {node.status === "completed" && node.completedAt ? `Completed ${new Date(node.completedAt).toLocaleDateString()}` : node.status === "in-progress" && node.startedAt ? `Started ${new Date(node.startedAt).toLocaleDateString()}` : "Pending"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t py-4 px-4 mt-8">
        <p className="text-center text-sm text-muted-foreground">Powered by Workflowz</p>
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
