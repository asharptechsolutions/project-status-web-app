"use client";
import { useState } from "react";
import { SignIn, SignUp } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Workflow,
  CheckCircle2,
  Users,
  BarChart3,
  Clock,
  FolderOpen,
  ArrowRight,
  Zap,
  Shield,
  Globe,
} from "lucide-react";

export function LandingPage() {
  const [showAuth, setShowAuth] = useState<false | "signin" | "signup">(false);

  if (showAuth) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Workflow className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">ProjectStatus</span>
          </div>
          {showAuth === "signin" ? (
            <SignIn
              routing="hash"
              appearance={{
                elements: { rootBox: "mx-auto w-full", card: "shadow-lg w-full" },
              }}
            />
          ) : (
            <SignUp
              routing="hash"
              appearance={{
                elements: { rootBox: "mx-auto w-full", card: "shadow-lg w-full" },
              }}
            />
          )}
          <p className="text-sm text-center text-muted-foreground mt-4">
            {showAuth === "signin" ? (
              <>Don&apos;t have an account?{" "}
                <button className="text-primary underline" onClick={() => setShowAuth("signup")}>Sign Up</button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button className="text-primary underline" onClick={() => setShowAuth("signin")}>Sign In</button>
              </>
            )}
            {" · "}
            <button className="text-primary underline" onClick={() => setShowAuth(false)}>Back</button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <Workflow className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">ProjectStatus</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/security/">Security</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAuth("signin")}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => setShowAuth("signup")}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16 sm:py-24">
        <Badge variant="secondary" className="mb-4">
          Project Management, Simplified
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight max-w-3xl mb-4">
          Manage projects and workflows{" "}
          <span className="text-primary">with ease</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mb-8">
          Track projects from start to finish with customizable stages, team assignments,
          role-based access, and real-time collaboration.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button size="lg" onClick={() => setShowAuth("signup")}>
            Start Free <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>
            See Features
          </Button>
        </div>
      </section>

      <section id="features" className="px-4 py-16 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">
            Everything you need to deliver projects on time
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: FolderOpen, title: "Project Management", desc: "Create projects with multi-stage workflows, assign team members, and track progress." },
              { icon: Users, title: "Team Roles", desc: "Admins manage everything. Workers update stages. Clients view their assigned projects." },
              { icon: Zap, title: "Reusable Templates", desc: "Save your best workflows as templates. Launch new projects in seconds." },
              { icon: Globe, title: "Client Access", desc: "Invite clients to view their projects with read-only access and chat." },
              { icon: BarChart3, title: "Progress Dashboard", desc: "See all projects at a glance with completion percentages and status badges." },
              { icon: Shield, title: "Secure & Private", desc: "Role-based access control, encrypted data, and organization-level isolation." },
            ].map((f) => (
              <Card key={f.title}>
                <CardContent className="pt-6">
                  <f.icon className="h-8 w-8 text-primary mb-3" />
                  <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-10">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { icon: Clock, step: "1", title: "Create a Project", desc: "Define stages, assign team members, and set up workflows." },
              { icon: CheckCircle2, step: "2", title: "Track Progress", desc: "Workers update stage status. Everyone sees real-time progress." },
              { icon: Globe, step: "3", title: "Collaborate", desc: "Chat, share files, and keep clients in the loop." },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mb-3">
                  {s.step}
                </div>
                <h3 className="font-semibold mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to streamline your workflow?</h2>
          <p className="text-lg opacity-90 mb-6">Free to use. No credit card required.</p>
          <Button size="lg" variant="secondary" onClick={() => setShowAuth("signup")}>
            Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      <footer className="border-t px-4 py-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            <span>ProjectStatus</span>
          </div>
          <Link href="/security/" className="hover:text-foreground transition-colors">Security</Link>
          <p>&copy; {new Date().getFullYear()} SharpTech.ai. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
