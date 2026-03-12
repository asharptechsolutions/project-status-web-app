"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AuthForm } from "@/components/auth-form";
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
  Sparkles,
} from "lucide-react";

export function LandingPage() {
  const [showAuth, setShowAuth] = useState<false | "signin" | "signup">(false);

  if (showAuth) {
    return (
      <AuthForm
        mode={showAuth}
        onToggle={() => setShowAuth(showAuth === "signin" ? "signup" : "signin")}
        onBack={() => setShowAuth(false)}
      />
    );
  }

  const features = [
    { icon: FolderOpen, title: "Project Management", desc: "Create projects with multi-stage workflows, assign team members, and track progress in real time." },
    { icon: Users, title: "Team Roles", desc: "Admins manage everything. Workers update stages. Clients view their assigned projects read-only." },
    { icon: Zap, title: "Reusable Templates", desc: "Save your best workflows as templates and launch new projects in seconds, not hours." },
    { icon: Globe, title: "Client Portal", desc: "Invite clients to view their projects with branded read-only access and built-in chat." },
    { icon: BarChart3, title: "Progress Dashboard", desc: "See all projects at a glance with completion bars, schedule tracking, and status badges." },
    { icon: Shield, title: "Secure & Private", desc: "Role-based access control, encrypted data, and complete organization-level data isolation." },
  ];

  const steps = [
    { icon: Clock, step: "01", title: "Create a Project", desc: "Define stages, assign team members, and set up your workflow in minutes." },
    { icon: CheckCircle2, step: "02", title: "Track Progress", desc: "Workers update stage status. Everyone sees real-time progress automatically." },
    { icon: Globe, step: "03", title: "Collaborate", desc: "Chat with clients, share updates, and keep everyone aligned effortlessly." },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Workflow className="h-4.5 w-4.5 text-primary" />
            </div>
            <span className="font-semibold text-lg tracking-tight">ProjectStatus</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/pricing/">Pricing</Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/security/">Security</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setShowAuth("signin")}>
              Sign In
            </Button>
            <Button size="sm" className="rounded-full px-5" onClick={() => setShowAuth("signup")}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex-1 flex flex-col items-center justify-center text-center px-4 py-20 sm:py-32">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/3 rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10">
          <div className="opacity-0 animate-fade-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 text-sm text-primary font-medium mb-6">
              <Sparkles className="h-3.5 w-3.5" />
              Project Management, Simplified
            </div>
          </div>

          <h1 className="opacity-0 animate-fade-up stagger-1 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl mb-5 leading-[1.1]">
            Manage workflows{" "}
            <span className="text-primary">with clarity</span>
          </h1>

          <p className="opacity-0 animate-fade-up stagger-2 text-lg sm:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
            Track projects from start to finish with customizable stages, team
            assignments, role-based access, and real-time collaboration.
          </p>

          <div className="opacity-0 animate-fade-up stagger-3 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" className="rounded-full px-8 h-12 text-base" onClick={() => setShowAuth("signup")}>
              Start Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full px-8 h-12 text-base"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            >
              See Features
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 py-20 sm:py-24 relative">
        <div className="absolute inset-0 bg-muted/40" />
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3 opacity-0 animate-fade-up">Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight opacity-0 animate-fade-up stagger-1">
              Everything you need to deliver on time
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <Card key={f.title} className={`opacity-0 animate-fade-up stagger-${i + 1} group border-transparent bg-card/80 backdrop-blur-sm hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300`}>
                <CardContent className="pt-7 pb-6">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/15 transition-colors">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-20 sm:py-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Three steps to streamlined projects</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8">
            {steps.map((s, i) => (
              <div key={s.step} className={`opacity-0 animate-fade-up stagger-${i + 1} flex flex-col items-center text-center`}>
                <div className="relative mb-5">
                  <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center text-2xl font-bold shadow-lg shadow-primary/20">
                    {s.step}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="hidden sm:block absolute top-1/2 left-full w-full h-px border-t-2 border-dashed border-primary/20 -translate-y-1/2 ml-4" />
                  )}
                </div>
                <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20 sm:py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-primary" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.1)_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(255,255,255,0.08)_0%,_transparent_60%)]" />
        <div className="max-w-3xl mx-auto text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl font-bold mb-5 text-primary-foreground tracking-tight">
            Ready to streamline your workflow?
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Free to use. No credit card required. Set up your first project in under two minutes.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="rounded-full px-8 h-12 text-base font-semibold shadow-lg"
            onClick={() => setShowAuth("signup")}
          >
            Get Started Free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
              <Workflow className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="font-medium text-foreground/70">ProjectStatus</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/pricing/" className="hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="/security/" className="hover:text-foreground transition-colors">
              Security
            </Link>
            <Link href="/privacy/" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/terms/" className="hover:text-foreground transition-colors">
              Terms
            </Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Sharp Tech Solutions. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
