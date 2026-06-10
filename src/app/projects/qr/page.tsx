"use client";
import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import { getProject, getProjectStages } from "@/lib/data";
import type { Project, ProjectStage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Printer, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";

function QrSheetInner() {
  const { orgId, isAdmin } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get("id");
  const [project, setProject] = useState<Project | null>(null);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("");

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const load = useCallback(async () => {
    if (!orgId || !projectId) { setLoading(false); return; }
    try {
      const p = await getProject(projectId);
      if (!p || p.team_id !== orgId) { setProject(null); return; }
      setProject(p);
      setStages(await getProjectStages(projectId));
    } catch (err: any) {
      toast.error(err.message || "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [orgId, projectId]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">Only admins can print QR codes.</div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[100dvh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center text-muted-foreground">Project not found.</div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 print:hidden">
        <div>
          <Button variant="ghost" onClick={() => router.push(`/projects?id=${project.id}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to project
          </Button>
          <h1 className="text-2xl font-bold mt-2 flex items-center gap-2">
            <QrCode className="h-6 w-6" /> Stage QR Codes
          </h1>
          <p className="text-sm text-muted-foreground">
            Print this sheet and attach the codes to job travelers. Workers scan a code to start or complete that stage.
          </p>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-2" /> Print
        </Button>
      </div>

      <div className="hidden print:block mb-6">
        <h1 className="text-xl font-bold">{project.name}</h1>
        <p className="text-sm">Stage QR codes — scan to start or complete a stage</p>
      </div>

      {stages.length === 0 ? (
        <Card className="print:hidden">
          <CardContent className="pt-6 text-center text-muted-foreground">
            This project has no stages yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 gap-4">
          {stages.map((stage) => (
            <div
              key={stage.id}
              className="border rounded-lg p-4 flex flex-col items-center gap-3 break-inside-avoid bg-card print:border-black/30"
            >
              <QRCodeSVG value={`${origin}/stage/${stage.id}`} size={160} marginSize={1} className="bg-white p-1 rounded" />
              <div className="text-center">
                <p className="text-xs text-muted-foreground truncate max-w-[220px]">{project.name}</p>
                <p className="font-semibold truncate max-w-[220px]">{stage.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function QrSheetPage() {
  return (
    <AuthGate>
      <Suspense fallback={<div className="flex items-center justify-center h-[100dvh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <QrSheetInner />
      </Suspense>
    </AuthGate>
  );
}
