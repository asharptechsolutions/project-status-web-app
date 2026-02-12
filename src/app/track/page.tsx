"use client";
import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { getProject, getProjectsForContact, createAccessCode, verifyAccessCode } from "@/lib/firestore";
import type { Project } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Workflow, ArrowLeft, Mail, ShieldCheck, LogOut, Link2 } from "lucide-react";
import { WorkflowCanvas } from "@/components/workflow-canvas";

const SESSION_KEY = "wfz_contact_session";

function getSession(): { email: string; expiresAt: number } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (session.expiresAt < Date.now()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function setSession(email: string) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    email,
    expiresAt: Date.now() + 60 * 60 * 1000,
  }));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

function TrackInner() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<"loading" | "email" | "code" | "projects" | "detail">("loading");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [tokenMode, setTokenMode] = useState(false);
  const [pendingProject, setPendingProject] = useState<Project | null>(null);

  const loadProjects = useCallback(async (contactEmail: string) => {
    setLoadingProjects(true);
    try {
      const p = await getProjectsForContact(contactEmail);
      setProjects(p.filter((proj) => proj.status !== "archived"));
      setVerifiedEmail(contactEmail);
      setStep("projects");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
      setStep("email");
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  const verifyTokenAccess = useCallback(async (contactEmail: string, project: Project) => {
    const contacts = project.contacts || [];
    const isAuthorized = contacts.some(
      (c: { email: string }) => c.email.toLowerCase() === contactEmail.toLowerCase()
    );
    if (isAuthorized) {
      setSession(contactEmail);
      setVerifiedEmail(contactEmail);
      setSelectedProject(project);
      setPendingProject(null);
      setStep("detail");
    } else {
      setError("Your email is not authorized to view this project. Contact the project owner to add your email.");
      setPendingProject(null);
      setStep("email");
    }
  }, []);

  useEffect(() => {
    const token = searchParams.get("token");
    const projectId = searchParams.get("id");

    // Token-based access — validate token, then require email verification
    if (token && projectId) {
      setTokenMode(true);
      (async () => {
        try {
          const project = await getProject(projectId);
          if (project && project.shareToken === token) {
            // Token valid — check if user already has a verified session
            const session = getSession();
            if (session) {
              await verifyTokenAccess(session.email, project);
            } else {
              // Store project, require email verification
              setPendingProject(project);
              setStep("email");
            }
          } else {
            setError("Invalid or expired tracking link. Please request a new one from the project owner.");
            setStep("email");
          }
        } catch {
          setError("Unable to load project. The link may be invalid.");
          setStep("email");
        }
      })();
      return;
    }

    // Check existing session for email-based access
    const session = getSession();
    if (session) {
      loadProjects(session.email);
    } else {
      setStep("email");
    }
  }, [loadProjects, verifyTokenAccess, searchParams]);

  // If a project ID is in the URL (without token) and we're verified, auto-select it
  useEffect(() => {
    const id = searchParams.get("id");
    const token = searchParams.get("token");
    if (id && !token && projects.length > 0 && step === "projects") {
      const found = projects.find((p) => p.id === id);
      if (found) {
        setSelectedProject(found);
        setStep("detail");
      }
    }
  }, [searchParams, projects, step]);

  const handleSendCode = async () => {
    if (!email.trim()) return;
    setError("");
    setSending(true);
    try {
      const accessCode = await createAccessCode(email);
      setGeneratedCode(accessCode);
      setStep("code");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send verification code");
    } finally {
      setSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!code.trim()) return;
    setError("");
    setVerifying(true);
    try {
      const valid = await verifyAccessCode(email, code.trim());
      if (!valid) {
        setError("Invalid or expired code. Please try again.");
        setVerifying(false);
        return;
      }
      setSession(email);
      // If we have a pending project from a share link, verify email against contacts
      if (pendingProject) {
        await verifyTokenAccess(email, pendingProject);
      } else {
        await loadProjects(email);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleLogout = () => {
    clearSession();
    setVerifiedEmail("");
    setProjects([]);
    setSelectedProject(null);
    setEmail("");
    setCode("");
    setGeneratedCode("");
    setTokenMode(false);
    setStep("email");
  };

  const noop = () => {};

  // Loading
  if (step === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[100dvh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Email entry
  if (step === "email") {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <div className="rounded-full bg-primary/10 p-3">
                <ShieldCheck className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-xl">Verify Your Identity</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the email address associated with your project to receive a verification code.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleSendCode} className="w-full" disabled={sending || !email.trim()}>
              <Mail className="h-4 w-4 mr-2" />
              {sending ? "Sending..." : "Send Verification Code"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Code entry
  if (step === "code") {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <div className="rounded-full bg-primary/10 p-3">
                <Mail className="h-8 w-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-xl">Enter Verification Code</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Your verification code is: <strong className="text-foreground text-lg tracking-widest">{generatedCode}</strong>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              (Email delivery coming soon — for now, enter the code shown above)
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="code">Verification Code</Label>
              <Input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
                autoFocus
                className="text-center text-2xl tracking-widest"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleVerifyCode} className="w-full" disabled={verifying || code.length !== 6}>
              {verifying ? "Verifying..." : "Verify & View Projects"}
            </Button>
            <div className="text-center">
              <Button variant="link" size="sm" onClick={() => { setStep("email"); setCode(""); setError(""); setGeneratedCode(""); }}>
                Use a different email
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Project detail view
  if (step === "detail" && selectedProject) {
    const progress = selectedProject.nodes.length
      ? Math.round((selectedProject.nodes.filter((n) => n.status === "completed").length / selectedProject.nodes.length) * 100)
      : 0;
    const currentNode = selectedProject.nodes.find((n) => n.status === "in-progress");

    return (
      <div className="min-h-[100dvh] bg-background">
        <header className="border-b py-4 px-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Workflow className="h-5 w-5 text-primary" />
              <span className="font-bold">Workflowz</span>
            </div>
            <div className="flex items-center gap-2">
              {verifiedEmail && <span className="text-sm text-muted-foreground hidden sm:inline">{verifiedEmail}</span>}
              {!tokenMode && (
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="p-4 max-w-4xl mx-auto">
          {!tokenMode && (
            <Button variant="ghost" className="mb-4" onClick={() => { setSelectedProject(null); setStep("projects"); }}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
            </Button>
          )}

          <div className="mb-6">
            <h1 className="text-2xl font-bold">{selectedProject.name}</h1>
            <p className="text-muted-foreground">Client: {selectedProject.clientName}</p>
          </div>

          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Overall Progress</span>
                <Badge variant={selectedProject.status === "completed" ? "default" : "secondary"}>{progress}%</Badge>
              </div>
              <div className="w-full bg-secondary rounded-full h-4">
                <div
                  className="bg-primary rounded-full h-4 transition-all flex items-center justify-center"
                  style={{ width: `${Math.max(progress, 5)}%` }}
                >
                  {progress > 15 && (
                    <span className="text-[10px] text-primary-foreground font-bold">{progress}%</span>
                  )}
                </div>
              </div>
              {currentNode && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Currently at: <strong className="text-foreground">{currentNode.label}</strong>
                </p>
              )}
              {selectedProject.status === "completed" && (
                <p className="mt-3 text-sm text-green-600 dark:text-green-400 font-medium">✅ Project completed!</p>
              )}
            </CardContent>
          </Card>

          <h2 className="text-lg font-semibold mb-3">Workflow</h2>
          <WorkflowCanvas
            nodes={selectedProject.nodes}
            edges={selectedProject.edges || []}
            workers={[]}
            onNodesUpdate={noop}
            onEdgesUpdate={noop}
            onStatusChange={noop}
            onAssignWorker={noop}
            onRemoveNode={noop}
            readOnly
          />
        </main>

        <footer className="border-t py-4 px-4 mt-8">
          <p className="text-center text-sm text-muted-foreground">Powered by Workflowz</p>
        </footer>
      </div>
    );
  }

  // Projects list
  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="border-b py-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Workflow className="h-5 w-5 text-primary" />
            <span className="font-bold">Workflowz</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">{verifiedEmail}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Your Projects</h1>

        {loadingProjects ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <p className="mb-2">No projects found for <strong>{verifiedEmail}</strong>.</p>
              <p className="text-sm">Make sure the project owner has added your email as a contact.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {projects.map((p) => {
              const prog = p.nodes.length
                ? Math.round((p.nodes.filter((n) => n.status === "completed").length / p.nodes.length) * 100)
                : 0;
              return (
                <Card
                  key={p.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => { setSelectedProject(p); setStep("detail"); }}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {p.nodes.length} stages
                        </p>
                      </div>
                      <Badge variant={p.status === "completed" ? "default" : "secondary"}>
                        {prog}%
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <footer className="border-t py-4 px-4 mt-8">
        <p className="text-center text-sm text-muted-foreground">Powered by Workflowz</p>
      </footer>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[100dvh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <TrackInner />
    </Suspense>
  );
}
