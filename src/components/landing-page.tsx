"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { LoginPage } from "@/components/login-page";
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
  const [showAuth, setShowAuth] = useState(false);

  if (showAuth) return <LoginPage />;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Navbar */}
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
            <Button variant="ghost" size="sm" onClick={() => setShowAuth(true)}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => setShowAuth(true)}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-16 sm:py-24">
        <Badge variant="secondary" className="mb-4">
          Project Management, Simplified
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight max-w-3xl mb-4">
          Manage projects and workflows{" "}
          <span className="text-primary">with ease</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mb-8">
          Track projects from start to finish with customizable stages, worker
          assignments, reusable templates, and real-time client tracking links.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button size="lg" onClick={() => setShowAuth(true)}>
            Start Free <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>
            See Features
          </Button>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-4 py-16 bg-muted/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">
            Everything you need to deliver projects on time
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: FolderOpen,
                title: "Project Management",
                desc: "Create projects with multi-stage workflows, assign workers, and track progress in real time.",
              },
              {
                icon: Users,
                title: "Worker Management",
                desc: "Add team members, assign them to specific project stages, and balance workloads.",
              },
              {
                icon: Zap,
                title: "Reusable Templates",
                desc: "Save your best workflows as templates. Launch new projects in seconds.",
              },
              {
                icon: Globe,
                title: "Client Tracking",
                desc: "Share a tracking link so clients can see project progress without needing an account.",
              },
              {
                icon: BarChart3,
                title: "Progress Dashboard",
                desc: "See all your projects at a glance with completion percentages and status badges.",
              },
              {
                icon: Shield,
                title: "Secure & Private",
                desc: "Your data is protected with Firebase authentication and per-user data isolation.",
              },
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

      {/* How it works */}
      <section className="px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-10">
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                icon: Clock,
                step: "1",
                title: "Create a Project",
                desc: "Define your project stages and assign team members.",
              },
              {
                icon: CheckCircle2,
                step: "2",
                title: "Track Progress",
                desc: "Update stage statuses as work progresses through the pipeline.",
              },
              {
                icon: Globe,
                step: "3",
                title: "Share with Clients",
                desc: "Send a tracking link so clients stay informed automatically.",
              },
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

      {/* CTA */}
      <section className="px-4 py-16 bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Ready to streamline your workflow?
          </h2>
          <p className="text-lg opacity-90 mb-6">
            Free to use. No credit card required.
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={() => setShowAuth(true)}
          >
            Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Footer */}
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
