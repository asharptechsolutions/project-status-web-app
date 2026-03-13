"use client";
import { useState } from "react";
import { Workflow, ArrowRight, ArrowLeft, SkipForward, Users, FolderPlus, Building2, Plus, Trash2, Loader2, Mail, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase";
import { createProject, createProjectStage, createSampleProject } from "@/lib/data";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

interface InvitedWorker {
  name: string;
  email: string;
}

const STEPS = [
  { label: "Company", icon: Building2 },
  { label: "Team", icon: Users },
  { label: "Project", icon: FolderPlus },
];

export function OrgSetup() {
  const { userId, refreshMember } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Company name
  const [companyName, setCompanyName] = useState("");
  const [orgId, setOrgId] = useState<string | null>(null);

  // Step 2: Invite workers
  const [workerName, setWorkerName] = useState("");
  const [workerEmail, setWorkerEmail] = useState("");
  const [invitedWorkers, setInvitedWorkers] = useState<InvitedWorker[]>([]);
  const [inviting, setInviting] = useState(false);

  // Step 3: Create project
  const [projectName, setProjectName] = useState("");

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !userId) return;
    setLoading(true);
    setError("");

    const supabase = createClient();

    try {
      // Create team
      const { data: team, error: teamErr } = await supabase
        .from("teams")
        .insert({ name: companyName.trim(), created_by: userId })
        .select("id")
        .single();
      if (teamErr) throw teamErr;

      // Add self as owner member
      const { error: memErr } = await supabase
        .from("team_members")
        .insert({
          user_id: userId,
          team_id: team.id,
          role: "owner",
          joined_at: new Date().toISOString(),
        });
      if (memErr) throw memErr;

      // Update profile with team_id
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ team_id: team.id })
        .eq("id", userId);
      if (profErr) throw profErr;

      // Store orgId locally — do NOT call refreshMember yet
      setOrgId(team.id);
      setStep(1);
    } catch (err: any) {
      setError(err.message || "Failed to create organization");
    } finally {
      setLoading(false);
    }
  };

  const handleInviteWorker = async () => {
    if (!orgId || !workerName.trim() || !workerEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/invite/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: workerEmail.toLowerCase().trim(),
          name: workerName.trim(),
          role: "worker",
          teamId: orgId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite");
      setInvitedWorkers((prev) => [...prev, { name: workerName.trim(), email: workerEmail.toLowerCase().trim() }]);
      setWorkerName("");
      setWorkerEmail("");
      toast.success(`Invitation sent to ${workerEmail}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to invite worker");
    } finally {
      setInviting(false);
    }
  };

  const handleCreateProject = async () => {
    if (!orgId || !userId || !projectName.trim()) return;
    setLoading(true);
    try {
      const projectId = await createProject({
        team_id: orgId,
        name: projectName.trim(),
        status: "active",
        client_name: "",
        client_email: "",
        client_phone: "",
        created_by: userId,
      });
      // Create a default "Getting Started" stage
      await createProjectStage({
        project_id: projectId,
        name: "Getting Started",
        status: "pending",
        position: 0,
        started_at: null,
        completed_at: null,
        started_by: null,
        assigned_to: null,
        estimated_completion: null,
        planned_start: null,
      });
      toast.success("Project created!");
      await finishWizard();
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
      setLoading(false);
    }
  };

  const handleCreateSample = async () => {
    if (!orgId || !userId) return;
    setLoading(true);
    try {
      await createSampleProject(orgId, userId);
      toast.success("Sample project created!");
      await finishWizard();
    } catch (err: any) {
      toast.error(err.message || "Failed to create sample project");
      setLoading(false);
    }
  };

  const finishWizard = async () => {
    setLoading(true);
    await refreshMember();
    // refreshMember sets orgId in AuthContext → AuthGate renders Dashboard
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <Workflow className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold">ProjectStatus</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isComplete = i < step;
          return (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && (
                <div className={`w-8 h-0.5 ${isComplete ? "bg-primary" : "bg-muted-foreground/30"}`} />
              )}
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isComplete
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isComplete ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step 1: Company Name */}
      {step === 0 && (
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold mb-2">What is your company name?</h2>
            <p className="text-muted-foreground">
              This will be your organization name in ProjectStatus.
            </p>
          </div>
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleCreateOrg} className="space-y-4">
                <div>
                  <Label>Company Name</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. Acme Construction"
                    required
                    autoFocus
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={loading || !companyName.trim()}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  {loading ? "Creating..." : "Continue"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 2: Invite Workers */}
      {step === 1 && (
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold mb-2">Invite your team</h2>
            <p className="text-muted-foreground">
              Add workers who will help manage projects. You can always add more later.
            </p>
          </div>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-3">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={workerName}
                    onChange={(e) => setWorkerName(e.target.value)}
                    placeholder="e.g. John Smith"
                    autoFocus
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={workerEmail}
                    onChange={(e) => setWorkerEmail(e.target.value)}
                    placeholder="john@example.com"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && workerName.trim() && workerEmail.trim()) {
                        e.preventDefault();
                        handleInviteWorker();
                      }
                    }}
                  />
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleInviteWorker}
                  disabled={!workerName.trim() || !workerEmail.trim() || inviting}
                >
                  {inviting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  {inviting ? "Sending..." : "Send Invite"}
                </Button>
              </div>

              {invitedWorkers.length > 0 && (
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Invited ({invitedWorkers.length})
                  </p>
                  <div className="space-y-2">
                    {invitedWorkers.map((w, i) => (
                      <div key={i} className="flex items-center justify-between text-sm bg-muted/50 rounded-md px-3 py-2">
                        <div>
                          <span className="font-medium">{w.name}</span>
                          <span className="text-muted-foreground ml-2">{w.email}</span>
                        </div>
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                  <SkipForward className="h-4 w-4 mr-2" />
                  Skip
                </Button>
                <Button className="flex-1" onClick={() => setStep(2)}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Create First Project */}
      {step === 2 && (
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h2 className="text-xl font-semibold mb-2">Create your first project</h2>
            <p className="text-muted-foreground">
              Get started with a project. You can customize stages and assign clients later.
            </p>
          </div>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <Label>Project Name</Label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="e.g. Kitchen Renovation — 123 Main St"
                  autoFocus
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCreateSample}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Try Sample
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateProject}
                  disabled={loading || !projectName.trim()}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <FolderPlus className="h-4 w-4 mr-2" />
                  )}
                  {loading ? "Creating..." : "Create"}
                </Button>
              </div>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={finishWizard}
                disabled={loading}
              >
                <SkipForward className="h-4 w-4 mr-2" />
                Skip for now
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
