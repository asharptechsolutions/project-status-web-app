"use client";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getProjects } from "@/lib/firestore";
import type { Project } from "@/lib/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
function Dashboard() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (user) getProjects(user.uid).then(setProjects).catch((err: any) => toast.error(err.message || "Failed to load projects"));
  }, [user]);

  const active = projects.filter((p) => p.status === "active");
  const completed = projects.filter((p) => p.status === "completed");

  const getProgress = (p: Project) => {
    if (!p.nodes.length) return 0;
    return Math.round((p.nodes.filter((n) => n.status === "completed").length / p.nodes.length) * 100);
  };

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />
      <main className="flex-1 p-4 max-w-6xl mx-auto w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Link href="/projects/?new=1">
            <Button>New Project</Button>
          </Link>
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

        <h2 className="text-lg font-semibold mb-3">Active Projects</h2>
        {active.length === 0 ? (
          <Card><CardContent className="pt-6 text-center text-muted-foreground">No active projects. Create one to get started!</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {active.map((p) => (
              <Link key={p.id} href={`/projects/?id=${p.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{p.name}</CardTitle>
                      <Badge variant="secondary">{getProgress(p)}%</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">Client: {p.clientName}</p>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${getProgress(p)}%` }} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{p.nodes.length} stages • {p.nodes.filter((n) => n.status === "in-progress").length} in progress</p>
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
  return <AuthGate><Dashboard /></AuthGate>;
}
