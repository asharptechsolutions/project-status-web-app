"use client";
import { Suspense, useRef, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Project, ProjectStage, ClientVisibilitySettings, StageDependency } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Workflow, Loader2, FolderOpen, Shield, CalendarDays, Network, BarChart3, Bell } from "lucide-react";
import dynamic from "next/dynamic";
import { ChatBubble, type ChatBubbleHandle } from "@/components/chat-bubble";
import { BookingDialog } from "@/components/booking-dialog";
import { useAuth } from "@/lib/auth-context";
import { AuthForm } from "@/components/auth-form";
import { toast } from "sonner";
import { getClientProjects, getClientVisibilitySettings, getStageDependencies, getClientNotificationPreferences, upsertClientNotificationPreferences } from "@/lib/data";

const WorkflowCanvas = dynamic(
  () => import("@/components/workflow-canvas").then((m) => m.WorkflowCanvas),
  { ssr: false, loading: () => <div className="h-[400px] flex items-center justify-center border rounded-lg"><Loader2 className="h-6 w-6 animate-spin" /></div> },
);

const GanttChart = dynamic(
  () => import("@/components/gantt-chart").then((m) => m.GanttChart),
  { ssr: false, loading: () => <div className="h-[300px] flex items-center justify-center border rounded-lg"><Loader2 className="h-6 w-6 animate-spin" /></div> },
);

async function checkTrackAccess(userId: string, projectId: string): Promise<boolean> {
  const supabase = createClient();

  // Get project's team_id
  const { data: project } = await supabase
    .from("projects").select("team_id").eq("id", projectId).single();
  if (!project) return false;

  // Check: is user a team member (any role) of this org?
  const { data: membership } = await supabase
    .from("team_members").select("role")
    .eq("user_id", userId).eq("team_id", project.team_id).single();
  if (membership) return true;

  // Check: is user an assigned client for this project?
  const { data: clientAssignment } = await supabase
    .from("project_clients").select("client_id")
    .eq("project_id", projectId).eq("client_id", userId).single();
  return !!clientAssignment;
}

function TrackInner() {
  const searchParams = useSearchParams();
  const { userId, user, loading: authLoading } = useAuth();
  const chatBubbleRef = useRef<ChatBubbleHandle>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accessDenied, setAccessDenied] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [clientProjects, setClientProjects] = useState<Project[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [visibilitySettings, setVisibilitySettings] = useState<ClientVisibilitySettings | null>(null);
  const [dependencies, setDependencies] = useState<StageDependency[]>([]);
  const [viewMode, setViewMode] = useState<"canvas" | "gantt">("canvas");
  const [notifyEnabled, setNotifyEnabled] = useState(true);

  const projectId = searchParams.get("id");

  const loadProject = useCallback(async () => {
    if (!projectId || !userId) return;

    setLoading(true);
    setAccessDenied(false);
    setError("");

    try {
      // Check authorization first
      const hasAccess = await checkTrackAccess(userId, projectId);
      if (!hasAccess) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const { data: proj } = await createClient().from("projects").select("*").eq("id", projectId).single();
      if (!proj) { setError("Project not found."); setLoading(false); return; }
      setProject(proj as Project);
      setOrgId(proj.team_id);

      const { data: stgs } = await createClient().from("project_stages").select("*").eq("project_id", projectId).order("position");
      setStages((stgs || []) as ProjectStage[]);

      // Fetch client visibility settings and dependencies
      try {
        const vs = await getClientVisibilitySettings(proj.team_id);
        setVisibilitySettings(vs);
      } catch {
        // null = show everything (defaults)
      }

      try {
        const deps = await getStageDependencies(projectId);
        setDependencies(deps);
      } catch {
        // empty deps is fine
      }

      // Load client notification preferences
      try {
        const prefs = await getClientNotificationPreferences(userId, projectId);
        setNotifyEnabled(prefs?.notify_stage_complete !== false); // null = default ON
      } catch {
        // default to on
      }

      // Load client's projects for booking dialog
      try {
        const cp = await getClientProjects(userId);
        setClientProjects(cp.length > 0 ? cp : [proj as Project]);
      } catch {
        setClientProjects([proj as Project]);
      }
    } catch {
      setError("Failed to load project.");
    } finally {
      setLoading(false);
    }
  }, [projectId, userId]);

  useEffect(() => {
    if (!authLoading && userId && projectId) {
      loadProject();
    } else if (!authLoading && !userId) {
      setLoading(false);
    }
  }, [authLoading, userId, projectId, loadProject]);

  // Still loading auth state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // No project ID
  if (!projectId) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] p-4">
        <Card><CardContent className="pt-6 text-center text-muted-foreground">No project ID provided.</CardContent></Card>
      </div>
    );
  }

  // Not authenticated — show sign-in form
  if (!userId) {
    const returnUrl = `${typeof window !== "undefined" ? window.location.pathname + window.location.search : "/"}`;
    const redirectUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback/?next=${encodeURIComponent(returnUrl)}`;

    return (
      <div className="min-h-[100dvh] bg-background">
        <header className="border-b py-4 px-4">
          <div className="max-w-4xl mx-auto flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            <span className="font-bold">ProjectStatus</span>
          </div>
        </header>
        <div className="flex items-center justify-center p-8">
          <div className="w-full max-w-md text-center">
            <p className="text-muted-foreground mb-6">Sign in to view this project.</p>
            <AuthForm
              mode={authMode}
              onToggle={() => setAuthMode((m) => m === "signin" ? "signup" : "signin")}
              compact
              showSignUp={false}
              redirectUrl={redirectUrl}
            />
          </div>
        </div>
      </div>
    );
  }

  // Loading project data
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Access denied
  if (accessDenied) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <header className="border-b py-4 px-4">
          <div className="max-w-4xl mx-auto flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            <span className="font-bold">ProjectStatus</span>
          </div>
        </header>
        <div className="flex items-center justify-center p-8">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center space-y-3">
              <Shield className="h-10 w-10 text-muted-foreground mx-auto" />
              <h2 className="text-lg font-semibold">Access Denied</h2>
              <p className="text-sm text-muted-foreground">
                You don&apos;t have permission to view this project. Contact the project owner if you believe this is an error.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[100dvh] p-4">
        <Card><CardContent className="pt-6 text-center text-muted-foreground">{error}</CardContent></Card>
      </div>
    );
  }

  if (!project) return null;

  const completedCount = stages.filter((s) => s.status === "completed").length;
  const progress = stages.length ? Math.round((completedCount / stages.length) * 100) : 0;

  // Visibility flags — null settings (no row) default to showing everything via !== false
  const showProgress = visibilitySettings?.show_progress_percentage !== false;
  const showBooking = visibilitySettings?.allow_booking !== false;
  const showFiles = visibilitySettings?.allow_file_access !== false;
  const showChat = visibilitySettings?.allow_chat !== false;
  const showChatBubble = showChat || showFiles; // need ChatBubble for openFiles() if files enabled

  const handleNotifyToggle = async (checked: boolean) => {
    if (!userId || !projectId || !orgId) return;
    setNotifyEnabled(checked);
    try {
      await upsertClientNotificationPreferences({
        team_id: orgId,
        client_id: userId,
        project_id: projectId,
        notify_stage_complete: checked,
      });
      toast.success(checked ? "Email notifications enabled" : "Email notifications disabled");
    } catch (err: any) {
      setNotifyEnabled(!checked); // revert on error
      toast.error(err.message || "Failed to update notification preferences");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b py-4 px-4">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <Workflow className="h-5 w-5 text-primary" />
          <span className="font-bold">ProjectStatus</span>
        </div>
      </header>

      <main className="p-4 max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Email notifications</span>
              <Switch checked={notifyEnabled} onCheckedChange={handleNotifyToggle} />
            </label>
            {orgId && showBooking && (
              <Button variant="outline" size="sm" onClick={() => setBookingOpen(true)}>
                <CalendarDays className="h-4 w-4 mr-1" /> Book a Call
              </Button>
            )}
            {showFiles && (
              <Button variant="outline" size="sm" onClick={() => chatBubbleRef.current?.openFiles()}>
                <FolderOpen className="h-4 w-4 mr-1" /> View Files
              </Button>
            )}
          </div>
        </div>

        {/* View toggle — only show if stages have dates */}
        {stages.some((s) => s.planned_start || s.estimated_completion) && (
          <div className="flex items-center gap-1 mb-3">
            <Button
              size="sm"
              variant={viewMode === "canvas" ? "default" : "outline"}
              onClick={() => setViewMode("canvas")}
            >
              <Network className="h-4 w-4 mr-1" /> Canvas
            </Button>
            <Button
              size="sm"
              variant={viewMode === "gantt" ? "default" : "outline"}
              onClick={() => setViewMode("gantt")}
            >
              <BarChart3 className="h-4 w-4 mr-1" /> Timeline
            </Button>
          </div>
        )}

        {viewMode === "canvas" ? (
          <WorkflowCanvas
            stages={stages}
            readOnly
            isAdmin={false}
            isWorker={false}
            progress={showProgress ? progress : undefined}
            locked
            savedPositions={project.workflow_positions}
            visibilitySettings={visibilitySettings}
            dependencies={dependencies}
          />
        ) : (
          <GanttChart
            stages={stages}
            dependencies={dependencies}
            readOnly
            isAdmin={false}
            isWorker={false}
            progress={showProgress ? progress : undefined}
            visibilitySettings={visibilitySettings}
          />
        )}
      </main>

      {project && showChatBubble && (
        <ChatBubble ref={chatBubbleRef} projectId={project.id} chatDisabled={!showChat} filesDisabled={!showFiles} />
      )}

      {orgId && userId && showBooking && (
        <BookingDialog
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          orgId={orgId}
          userId={userId}
          userName={user?.user_metadata?.full_name || user?.email || "Client"}
          projects={clientProjects}
        />
      )}

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
