"use client";
import { useState, useRef, useEffect, useCallback } from "react";
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
  Eye,
  Sparkles,
  LayoutDashboard,
  UserCheck,
} from "lucide-react";

// ============ HERO CAROUSEL ============

// Edge connections for workflow canvas: [sourceNodeId, targetNodeId]
const EDGES: [string, string][] = [
  ["material", "cnc"],
  ["cnc", "heat"],
  ["heat", "grinding"],
  ["cnc", "deburr"],
  ["grinding", "qc"],
  ["deburr", "qc"],
  ["qc", "shipping"],
];

interface EdgePath { d: string; key: string; }

function HeroCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [edges, setEdges] = useState<EdgePath[]>([]);

  const computeEdges = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const getRect = (id: string) => {
      const el = nodeRefs.current[id];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left - cRect.left + r.width / 2, y: r.top - cRect.top + r.height / 2, right: r.right - cRect.left, left: r.left - cRect.left, top: r.top - cRect.top, bottom: r.bottom - cRect.top };
    };
    const paths: EdgePath[] = [];
    for (const [srcId, tgtId] of EDGES) {
      const src = getRect(srcId);
      const tgt = getRect(tgtId);
      if (!src || !tgt) continue;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const horiz = Math.abs(dx) > Math.abs(dy);
      let x1: number, y1: number, x2: number, y2: number;
      if (horiz) { x1 = dx > 0 ? src.right : src.left; y1 = src.y; x2 = dx > 0 ? tgt.left : tgt.right; y2 = tgt.y; }
      else { x1 = src.x; y1 = dy > 0 ? src.bottom : src.top; x2 = tgt.x; y2 = dy > 0 ? tgt.top : tgt.bottom; }
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const d = horiz ? `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}` : `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
      paths.push({ d, key: `${srcId}-${tgtId}` });
    }
    setEdges(paths);
  }, []);

  useEffect(() => {
    const timer = setTimeout(computeEdges, 100);
    window.addEventListener("resize", computeEdges);
    return () => { clearTimeout(timer); window.removeEventListener("resize", computeEdges); };
  }, [computeEdges]);

  const setNodeRef = (id: string) => (el: HTMLDivElement | null) => { nodeRefs.current[id] = el; };
  const nodeBase = "rounded-lg border-2 shadow-sm px-4 py-3 w-[170px]";
  const completed = `${nodeBase} border-green-500/50 bg-green-50 dark:bg-green-950/30`;
  const inProgress = `${nodeBase} border-blue-500/50 bg-blue-50 dark:bg-blue-950/30`;
  const pending = `${nodeBase} border-border bg-card`;

  return (
    <div ref={containerRef} className="relative bg-background" style={{ height: 400 }}>
      <DotGrid id="canvas" />
      <div className="absolute top-3 left-3 z-20 bg-background/90 backdrop-blur rounded-lg border shadow-sm px-3 py-1.5">
        <p className="text-xs font-semibold">Precision Gear Assembly — Batch #4720</p>
      </div>
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 bg-background/90 backdrop-blur rounded-lg border shadow-sm px-3 py-1.5">
        <span className="text-xs text-muted-foreground font-medium">Progress</span>
        <div className="w-24 h-2 rounded-full bg-secondary overflow-hidden"><div className="w-[43%] h-full bg-primary rounded-full" /></div>
        <span className="text-xs text-muted-foreground font-medium">43%</span>
      </div>
      <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="hero-arrow" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
            <polygon points="0 0, 10 3.5, 0 7" className="fill-primary" />
          </marker>
        </defs>
        {edges.map((e) => (
          <path key={e.key} d={e.d} fill="none" className="stroke-primary" strokeWidth="2" markerEnd="url(#hero-arrow)" strokeDasharray="6 3">
            <animate attributeName="stroke-dashoffset" values="18;0" dur="1.5s" repeatCount="indefinite" />
          </path>
        ))}
      </svg>
      {/* Row 1 */}
      <div ref={setNodeRef("material")} className={`absolute z-10 ${completed}`} style={{ left: "12.5%", top: 60, transform: "translateX(-50%)" }}>
        <StatusLabel status="completed" /><p className="font-semibold text-sm">Material Intake</p><p className="text-[11px] text-muted-foreground mt-1">6061 Aluminum · 200 units</p>
      </div>
      <div ref={setNodeRef("cnc")} className={`absolute z-10 ${completed}`} style={{ left: "37.5%", top: 60, transform: "translateX(-50%)" }}>
        <StatusLabel status="completed" /><p className="font-semibold text-sm">CNC Machining</p><p className="text-[11px] text-muted-foreground mt-1">5-axis mill · Prog #A-4720</p>
      </div>
      <div ref={setNodeRef("heat")} className={`absolute z-10 ${inProgress}`} style={{ left: "62.5%", top: 60, transform: "translateX(-50%)" }}>
        <StatusLabel status="in_progress" /><p className="font-semibold text-sm">Heat Treatment</p><p className="text-[11px] text-muted-foreground mt-1">Carburizing · 8hr cycle</p>
      </div>
      <div ref={setNodeRef("grinding")} className={`absolute z-10 ${pending}`} style={{ left: "87.5%", top: 60, transform: "translateX(-50%)" }}>
        <StatusLabel status="pending" /><p className="font-semibold text-sm">Grinding & Finishing</p><p className="text-[11px] text-muted-foreground mt-1">Surface grind · 0.001&quot; tol</p>
      </div>
      {/* Row 2 */}
      <div ref={setNodeRef("deburr")} className={`absolute z-10 ${completed}`} style={{ left: "25%", top: 240, transform: "translateX(-50%)" }}>
        <StatusLabel status="completed" /><p className="font-semibold text-sm">Deburring</p><p className="text-[11px] text-muted-foreground mt-1">Tumble finish · 2hr</p>
      </div>
      <div ref={setNodeRef("qc")} className={`absolute z-10 ${pending}`} style={{ left: "50%", top: 240, transform: "translateX(-50%)" }}>
        <StatusLabel status="pending" /><p className="font-semibold text-sm">QC Inspection</p><p className="text-[11px] text-muted-foreground mt-1">CMM verify · GD&amp;T check</p>
      </div>
      <div ref={setNodeRef("shipping")} className={`absolute z-10 ${pending}`} style={{ left: "75%", top: 240, transform: "translateX(-50%)" }}>
        <StatusLabel status="pending" /><p className="font-semibold text-sm">Shipping</p><p className="text-[11px] text-muted-foreground mt-1">Pack &amp; crate · FOB origin</p>
      </div>
    </div>
  );
}

function StatusLabel({ status }: { status: "completed" | "in_progress" | "pending" }) {
  if (status === "completed") return (
    <div className="flex items-center gap-1.5 mb-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /><span className="text-[11px] font-medium text-green-600 dark:text-green-400">Completed</span></div>
  );
  if (status === "in_progress") return (
    <div className="flex items-center gap-1.5 mb-1"><Clock className="h-3.5 w-3.5 text-blue-500" /><span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">In Progress</span></div>
  );
  return (
    <div className="flex items-center gap-1.5 mb-1"><div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" /><span className="text-[11px] font-medium text-muted-foreground">Pending</span></div>
  );
}

function DotGrid({ id }: { id: string }) {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.15]" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id={`hero-dots-${id}`} x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="currentColor" className="text-foreground" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#hero-dots-${id})`} />
    </svg>
  );
}

function HeroKanban() {
  const columns = [
    {
      title: "Pending",
      color: "text-muted-foreground",
      bg: "bg-muted/50",
      cards: [
        { name: "Grinding & Finishing", detail: "Surface grind · 0.001\" tol" },
        { name: "QC Inspection", detail: "CMM verify · GD&T check" },
        { name: "Shipping", detail: "Pack & crate · FOB origin" },
      ],
    },
    {
      title: "In Progress",
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/5",
      cards: [
        { name: "Heat Treatment", detail: "Carburizing · 8hr cycle" },
      ],
    },
    {
      title: "Completed",
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-500/5",
      cards: [
        { name: "Material Intake", detail: "6061 Aluminum · 200 units" },
        { name: "CNC Machining", detail: "5-axis mill · Prog #A-4720" },
        { name: "Deburring", detail: "Tumble finish · 2hr" },
      ],
    },
  ];

  return (
    <div className="relative bg-background p-4 pt-12" style={{ height: 400 }}>
      <div className="absolute top-3 left-3 z-20 bg-background/90 backdrop-blur rounded-lg border shadow-sm px-3 py-1.5">
        <p className="text-xs font-semibold">Precision Gear Assembly — Batch #4720</p>
      </div>
      <div className="absolute top-3 right-3 z-20 bg-background/90 backdrop-blur rounded-lg border shadow-sm px-3 py-1.5">
        <p className="text-xs text-muted-foreground font-medium">Kanban View</p>
      </div>
      <div className="grid grid-cols-3 gap-3 h-full">
        {columns.map((col) => (
          <div key={col.title} className={`rounded-lg border ${col.bg} p-3 flex flex-col`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className={`text-xs font-semibold uppercase tracking-wider ${col.color}`}>{col.title}</h4>
              <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{col.cards.length}</span>
            </div>
            <div className="space-y-2 flex-1">
              {col.cards.map((card) => (
                <div key={card.name} className="rounded-md border bg-card p-2.5 shadow-sm">
                  <p className="font-medium text-sm">{card.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{card.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroClientPortal() {
  const stages = [
    { name: "Material Intake", status: "completed" as const },
    { name: "CNC Machining", status: "completed" as const },
    { name: "Deburring", status: "completed" as const },
    { name: "Heat Treatment", status: "in_progress" as const },
    { name: "Grinding & Finishing", status: "pending" as const },
    { name: "QC Inspection", status: "pending" as const },
    { name: "Shipping", status: "pending" as const },
  ];
  const completed = stages.filter((s) => s.status === "completed").length;
  const pct = Math.round((completed / stages.length) * 100);

  return (
    <div className="relative bg-background p-4 pt-9 overflow-hidden" style={{ height: 400 }}>
      <div className="absolute top-3 left-3 z-20 bg-background/90 backdrop-blur rounded-lg border shadow-sm px-3 py-1.5">
        <p className="text-xs font-semibold">Client Portal</p>
      </div>
      <div className="max-w-md mx-auto">
        <div className="text-center mb-2">
          <h3 className="font-semibold text-base">Precision Gear Assembly</h3>
          <p className="text-xs text-muted-foreground">Batch #4720 · Summit Contracting LLC</p>
        </div>
        {/* Progress circle */}
        <div className="flex items-center gap-3 mb-3 justify-center">
          <div className="relative h-11 w-11">
            <svg viewBox="0 0 36 36" className="h-11 w-11 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-secondary" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-primary" strokeWidth="3" strokeDasharray={`${pct} ${100 - pct}`} strokeLinecap="round" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{pct}%</span>
          </div>
          <div>
            <p className="text-sm font-medium">{completed} of {stages.length} stages complete</p>
            <p className="text-[11px] text-muted-foreground">Estimated completion: Mar 28, 2026</p>
          </div>
        </div>
        {/* Stage list */}
        <div className="space-y-0.5">
          {stages.map((s, i) => (
            <div key={s.name} className={`flex items-center gap-2.5 rounded-md px-3 py-[5px] ${s.status === "in_progress" ? "bg-blue-500/5 border border-blue-500/20" : ""}`}>
              <div className="shrink-0">
                {s.status === "completed" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                ) : s.status === "in_progress" ? (
                  <Clock className="h-3.5 w-3.5 text-blue-500" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30" />
                )}
              </div>
              <span className={`text-sm flex-1 ${s.status === "completed" ? "line-through text-muted-foreground" : s.status === "in_progress" ? "font-medium" : ""}`}>{s.name}</span>
              <span className="text-[10px] text-muted-foreground">{i + 1}/{stages.length}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroGantt() {
  const today = 10; // "today" is day 10 of the timeline for visual purposes
  const stages = [
    { name: "Material Intake", start: 0, end: 3, status: "completed" as const },
    { name: "CNC Machining", start: 3, end: 8, status: "completed" as const },
    { name: "Deburring", start: 5, end: 9, status: "completed" as const },
    { name: "Heat Treatment", start: 8, end: 13, status: "in_progress" as const },
    { name: "Grinding & Finishing", start: 13, end: 17, status: "pending" as const },
    { name: "QC Inspection", start: 17, end: 19, status: "pending" as const },
    { name: "Shipping", start: 19, end: 21, status: "pending" as const },
  ];
  const totalDays = 21;
  const weeks = ["Week 1", "Week 2", "Week 3"];

  return (
    <div className="relative bg-background p-4 pt-11 overflow-hidden" style={{ height: 400 }}>
      <div className="absolute top-3 left-3 z-20 bg-background/90 backdrop-blur rounded-lg border shadow-sm px-3 py-1.5">
        <p className="text-xs font-semibold">Precision Gear Assembly — Batch #4720</p>
      </div>
      <div className="absolute top-3 right-3 z-20 bg-background/90 backdrop-blur rounded-lg border shadow-sm px-3 py-1.5">
        <p className="text-xs text-muted-foreground font-medium">Gantt View</p>
      </div>

      <div className="mt-2 flex h-[calc(100%-1rem)]">
        {/* Stage labels */}
        <div className="shrink-0 w-[140px] pr-2 flex flex-col">
          {/* Header spacer */}
          <div className="h-8 flex items-end pb-1">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Stage</span>
          </div>
          <div className="flex-1 flex flex-col justify-around">
            {stages.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5 h-7">
                {s.status === "completed" ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                ) : s.status === "in_progress" ? (
                  <Clock className="h-3 w-3 text-blue-500 shrink-0" />
                ) : (
                  <div className="h-3 w-3 rounded-full border-[1.5px] border-muted-foreground/30 shrink-0" />
                )}
                <span className="text-xs truncate">{s.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart area */}
        <div className="flex-1 flex flex-col border-l">
          {/* Week headers */}
          <div className="h-8 flex items-end border-b">
            {weeks.map((w, i) => (
              <div key={w} className="flex-1 text-center pb-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{w}</span>
              </div>
            ))}
          </div>

          {/* Grid + bars */}
          <div className="flex-1 relative">
            {/* Vertical grid lines (every 7 days) */}
            {[7, 14].map((d) => (
              <div key={d} className="absolute top-0 bottom-0 border-l border-dashed border-border/60" style={{ left: `${(d / totalDays) * 100}%` }} />
            ))}

            {/* Today marker */}
            <div className="absolute top-0 bottom-0 w-px bg-primary/60" style={{ left: `${(today / totalDays) * 100}%` }}>
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[9px] font-medium px-1.5 py-0.5 rounded-b-sm whitespace-nowrap">
                Today
              </div>
            </div>

            {/* Bars */}
            <div className="absolute inset-0 flex flex-col justify-around">
              {stages.map((s) => {
                const left = (s.start / totalDays) * 100;
                const width = ((s.end - s.start) / totalDays) * 100;
                const bg = s.status === "completed"
                  ? "bg-green-500/70 dark:bg-green-500/50"
                  : s.status === "in_progress"
                    ? "bg-blue-500/70 dark:bg-blue-500/50"
                    : "bg-muted-foreground/20";
                return (
                  <div key={s.name} className="h-7 flex items-center relative px-1">
                    <div
                      className={`h-5 rounded-md ${bg} transition-all`}
                      style={{ marginLeft: `${left}%`, width: `${width}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SLIDES = [
  { label: "Workflow", component: HeroCanvas },
  { label: "Kanban", component: HeroKanban },
  { label: "Gantt Chart", component: HeroGantt },
  { label: "Client Portal", component: HeroClientPortal },
];

function HeroCarousel() {
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setActive((p) => (p + 1) % SLIDES.length), 5000);
  }, []);

  useEffect(() => {
    resetTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [resetTimer]);

  const goTo = (idx: number) => { setActive(idx); resetTimer(); };

  return (
    <div className="relative overflow-hidden">
      <div className="relative" style={{ height: 400 }}>
        {SLIDES.map((slide, i) => (
          <div key={slide.label} className={`absolute inset-0 transition-opacity duration-500 ${active === i ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
            <slide.component />
          </div>
        ))}
      </div>
      {/* Navigation pills */}
      <div className="flex items-center justify-center gap-3 py-3 border-t bg-muted/30">
        {SLIDES.map((slide, i) => (
          <button key={slide.label} onClick={() => goTo(i)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${active === i ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {slide.label}
          </button>
        ))}
      </div>
    </div>
  );
}

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
    { icon: FolderOpen, title: "Multi-Stage Workflows", desc: "Break projects into sequential stages like 'Documents → Review → Approval → Closing'. Each stage has its own status, assignee, and timeline." },
    { icon: UserCheck, title: "Role-Based Views", desc: "Admins see everything. Workers update their assigned stages. Clients get a clean, read-only view of their project's progress." },
    { icon: Zap, title: "Workflow Templates", desc: "Save your best workflows as templates. Launch new client projects in seconds with pre-built stage sequences." },
    { icon: Eye, title: "Client Tracking Portal", desc: "Give each client a login to track their project. They see progress, stages, and status — nothing more, nothing less." },
    { icon: BarChart3, title: "Real-Time Dashboard", desc: "Every stage update reflects instantly across all views. Progress bars, status badges, and completion tracking — always current." },
    { icon: Shield, title: "Team & Data Isolation", desc: "Each organization's data is completely isolated with row-level security. No data ever leaks between teams." },
  ];

  const steps = [
    { icon: LayoutDashboard, step: "01", title: "Design Your Workflow", desc: "Create a project with custom stages that match your actual process. Assign team members to each stage." },
    { icon: CheckCircle2, step: "02", title: "Your Team Works", desc: "Workers mark stages as in progress and complete. Progress updates automatically for everyone." },
    { icon: Users, step: "03", title: "Clients Stay Informed", desc: "Clients log in and see real-time status. No more 'where's my project?' emails." },
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
      <section className="relative flex flex-col items-center justify-center text-center px-4 pt-20 sm:pt-32 pb-16 sm:pb-20">
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
              Client-Facing Project Tracking
            </div>
          </div>

          <h1 className="opacity-0 animate-fade-up stagger-1 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight max-w-3xl mb-5 leading-[1.1]">
            Show clients exactly{" "}
            <span className="text-primary">where they stand</span>
          </h1>

          <p className="opacity-0 animate-fade-up stagger-2 text-lg sm:text-xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
            Build multi-stage workflows, assign your team, and give every client
            a real-time tracking portal. No more status update emails.
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
              See How It Works
            </Button>
          </div>
        </div>
      </section>

      {/* App Preview — Workflow Canvas */}
      <section className="px-4 pb-20 sm:pb-28">
        <div className="max-w-5xl mx-auto">
          <div className="opacity-0 animate-fade-up stagger-4 rounded-xl border bg-card shadow-2xl shadow-primary/5 overflow-hidden">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/50">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/60" />
                <div className="w-3 h-3 rounded-full bg-green-400/60" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="text-xs text-muted-foreground bg-muted rounded-md px-3 py-1">projectstatus.app/projects</div>
              </div>
            </div>

            {/* Canvas area */}
            <HeroCarousel />
          </div>

          {/* Annotation */}
          <div className="flex justify-center mt-5 gap-6 sm:gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span>Your team updates stages</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <span>Your clients see progress</span>
            </div>
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
              Built for teams that serve clients
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
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Three steps to happy clients</h2>
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
            Stop sending status update emails
          </h2>
          <p className="text-lg text-primary-foreground/80 mb-8 max-w-xl mx-auto">
            Free during early access. No credit card required. Set up your first project in two minutes.
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
