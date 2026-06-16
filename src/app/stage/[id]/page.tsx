"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import {
  getProjectStage, getProject, getProjectStages, getStageDependencies,
  getAutomationSettings, getActiveTimer, getMembers, uploadFile, getStagePhotos,
} from "@/lib/data";
import { performStageTransition } from "@/lib/stage-actions";
import { notifyClientStageEvent } from "@/lib/client-notify";
import type { Project, ProjectStage, StageDependency, AutomationSettings, TimeEntry, Member, ProjectFile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Play, CheckCircle2, Clock, Loader2, AlertTriangle, UserCircle,
  CalendarDays, FolderOpen, Building2, ArrowRight, Camera, PauseCircle, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return null;
  }
}

function StageActionInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { userId, isAdmin, isWorker, isClient, member } = useAuth();
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [stage, setStage] = useState<ProjectStage | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [dependencies, setDependencies] = useState<StageDependency[]>([]);
  const [automationSettings, setAutomationSettings] = useState<AutomationSettings | null>(null);
  const [activeTimer, setActiveTimer] = useState<TimeEntry | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [photos, setPhotos] = useState<ProjectFile[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const load = useCallback(async () => {
    if (!id || !userId) return;
    try {
      const s = await getProjectStage(id);
      if (!s) { setStage(null); return; }
      const p = await getProject(s.project_id);
      if (!p) { setStage(null); return; }
      const [allStages, deps, autoSettings, timer, teamMembers, stagePhotos] = await Promise.all([
        getProjectStages(p.id),
        getStageDependencies(p.id),
        getAutomationSettings(p.team_id),
        getActiveTimer(userId, p.team_id),
        getMembers(p.team_id).catch(() => [] as Member[]),
        getStagePhotos(p.id).catch(() => [] as ProjectFile[]),
      ]);
      setStage(s);
      setProject(p);
      setStages(allStages);
      setDependencies(deps);
      setAutomationSettings(autoSettings);
      setActiveTimer(timer);
      setMembers(teamMembers);
      setPhotos(stagePhotos.filter((ph) => ph.stage_id === s.id));
    } catch (err: any) {
      toast.error(err.message || "Failed to load stage");
    } finally {
      setLoading(false);
    }
  }, [id, userId]);

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !stage || !project || !userId) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Photo too large (max 10MB)"); return; }
    setUploadingPhoto(true);
    try {
      const uploaded = await uploadFile(project.id, file, userId, undefined, stage.id);
      setPhotos((prev) => [...prev, uploaded]);
      notifyClientStageEvent(project, stage, "photo_added");
      toast.success("Photo added");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  const handleTransition = async (status: ProjectStage["status"]) => {
    if (!stage || !project || !userId) return;
    setActing(true);
    try {
      const { updatedStages, projectCompleted, stoppedTimer, startedTimer, approvalRequested } = await performStageTransition({
        stage,
        project,
        stages,
        dependencies,
        automationSettings,
        userId,
        actorName: member?.name || "",
        status,
        canActOnAnyStage: isAdmin,
        activeTimer,
      });
      if (approvalRequested) {
        setStages(updatedStages);
        setStage(updatedStages.find((s) => s.id === stage.id) || stage);
        notifyClientStageEvent(project, stage, "approval_requested");
        toast.success("Sent to the client for approval");
        return;
      }
      if (stoppedTimer) {
        setActiveTimer(null);
        toast.info(`Timer stopped: ${formatMinutes(stoppedTimer.duration_minutes || 0)} logged`);
      }
      if (startedTimer) {
        setActiveTimer(startedTimer);
        toast.info("Timer started");
      }
      setStages(updatedStages);
      setStage(updatedStages.find((s) => s.id === stage.id) || { ...stage, status });
      notifyClientStageEvent(project, stage, status === "in_progress" ? "stage_started" : status === "completed" ? "stage_completed" : null);
      if (projectCompleted) {
        setProject({ ...project, status: "completed" });
        notifyClientStageEvent(project, null, "project_completed");
        toast.success("Project completed!");
      } else {
        toast.success(status === "in_progress" ? "Stage started" : "Stage completed");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update stage");
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[100dvh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stage || !project) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-2">
            <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
            <p className="font-medium">Stage not found</p>
            <p className="text-sm text-muted-foreground">
              This stage doesn&apos;t exist or you don&apos;t have access to it. Make sure you&apos;re logged in with the right account.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const assignee = stage.assigned_to ? members.find((m) => m.user_id === stage.assigned_to) : null;
  const blockedBy = dependencies
    .filter((d) => d.target_stage_id === stage.id)
    .map((d) => stages.find((s) => s.id === d.source_stage_id))
    .filter((s): s is ProjectStage => !!s && s.status !== "completed");
  const canAct = !isClient && (isAdmin || stage.assigned_to === userId);
  const estimate = formatDate(stage.estimated_completion);

  return (
    <div className="min-h-[100dvh] bg-muted/30 flex flex-col items-center p-4 pt-8 sm:pt-16">
      <div className="w-full max-w-md space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span className="truncate">{project.name}</span>
            </div>
            {(project.client_name || project.company_id) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{project.client_name || "Client project"}</span>
              </div>
            )}
            <div className="flex items-start justify-between gap-2 pt-1">
              <CardTitle className="text-xl">{stage.name}</CardTitle>
              <Badge
                variant="outline"
                className={
                  stage.status === "completed"
                    ? "border-green-500/50 text-green-600 dark:text-green-400 shrink-0"
                    : stage.status === "in_progress"
                      ? "border-blue-500/50 text-blue-600 dark:text-blue-400 shrink-0"
                      : "shrink-0"
                }
              >
                {stage.status === "completed" ? "Completed" : stage.status === "in_progress" ? "In Progress" : "Pending"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-sm">
              {assignee && (
                <div className="flex items-center gap-2">
                  <UserCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>Assigned to <span className="font-medium">{assignee.name || assignee.email}</span></span>
                </div>
              )}
              {estimate && (
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>Estimated completion: <span className="font-medium">{estimate}</span></span>
                </div>
              )}
              {stage.started_at && stage.status !== "pending" && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>Started {formatDate(stage.started_at)}</span>
                </div>
              )}
            </div>

            {blockedBy.length > 0 && stage.status === "pending" && (
              <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Waiting on previous stages</p>
                  <p className="text-muted-foreground">{blockedBy.map((s) => s.name).join(", ")}</p>
                </div>
              </div>
            )}

            {stage.on_hold && (
              <div className="flex items-start gap-2 rounded-md border border-orange-500/40 bg-orange-500/10 p-3 text-sm">
                <PauseCircle className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">On hold</p>
                  {stage.hold_reason && <p className="text-muted-foreground">{stage.hold_reason}</p>}
                </div>
              </div>
            )}

            {stage.requires_client_approval && stage.approval_status === "pending" && (
              <div className="flex items-start gap-2 rounded-md border border-blue-500/40 bg-blue-500/10 p-3 text-sm">
                <ShieldCheck className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Awaiting client approval</p>
                  <p className="text-muted-foreground">The client needs to sign off before this stage completes.</p>
                </div>
              </div>
            )}

            {stage.approval_status === "changes_requested" && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Client requested changes</p>
                  {stage.approval_note && <p className="text-muted-foreground">&ldquo;{stage.approval_note}&rdquo;</p>}
                </div>
              </div>
            )}

            {/* Progress photos */}
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p.id} src={p.file_url} alt="Stage progress" className="aspect-square w-full rounded-md object-cover border" />
                ))}
              </div>
            )}

            {!isClient && stage.status !== "pending" && (
              <>
                <input id="stage-photo" type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} />
                <Button variant="outline" className="w-full" onClick={() => document.getElementById("stage-photo")?.click()} disabled={uploadingPhoto}>
                  {uploadingPhoto ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Camera className="h-4 w-4 mr-2" />}
                  Add progress photo
                </Button>
              </>
            )}

            {isClient ? (
              <Button className="w-full h-12" variant="outline" onClick={() => router.push(`/track?id=${project.id}`)}>
                View project status <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : stage.status === "pending" ? (
              <>
                <Button className="w-full h-14 text-base" onClick={() => handleTransition("in_progress")} disabled={!canAct || acting}>
                  {acting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Play className="h-5 w-5 mr-2" />}
                  Start Stage
                </Button>
                {!canAct && (
                  <p className="text-xs text-center text-muted-foreground">
                    {assignee
                      ? `This stage is assigned to ${assignee.name || assignee.email || "another worker"}.`
                      : "This stage has no assigned worker — a project manager must start it."}
                  </p>
                )}
              </>
            ) : stage.status === "in_progress" ? (
              <>
                <Button className="w-full h-14 text-base" onClick={() => handleTransition("completed")} disabled={!canAct || acting}>
                  {acting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                  Complete Stage
                </Button>
                {!canAct && (
                  <p className="text-xs text-center text-muted-foreground">
                    {assignee
                      ? `This stage is assigned to ${assignee.name || assignee.email || "another worker"}.`
                      : "This stage has no assigned worker — a project manager must start it."}
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
                <p className="text-sm font-medium">This stage is complete</p>
              </div>
            )}

            {!isClient && (
              <Button variant="ghost" className="w-full" onClick={() => router.push(`/projects?id=${project.id}`)}>
                Open full project <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function StageActionPage() {
  return (
    <AuthGate>
      <StageActionInner />
    </AuthGate>
  );
}
