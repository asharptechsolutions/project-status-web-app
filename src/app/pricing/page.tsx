import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Workflow,
  ArrowLeft,
  Check,
  Sparkles,
  FolderOpen,
  Users,
  Globe,
  BarChart3,
  Zap,
  MessageSquare,
  CalendarDays,
  Upload,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing - ProjectStatus",
  description:
    "ProjectStatus is free during early access. Manage projects, track workflows, and collaborate with clients at no cost.",
};

const included = [
  { icon: FolderOpen, text: "Unlimited projects" },
  { icon: Users, text: "Unlimited team members" },
  { icon: Globe, text: "Client tracking portal" },
  { icon: Zap, text: "Workflow templates" },
  { icon: BarChart3, text: "Progress dashboards" },
  { icon: MessageSquare, text: "Project chat" },
  { icon: CalendarDays, text: "Scheduling & booking" },
  { icon: Upload, text: "File uploads" },
];

export default function PricingPage() {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      {/* Navbar */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-14">
          <Link href="/" className="flex items-center gap-2">
            <Workflow className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">ProjectStatus</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 py-16 sm:py-24 text-center">
        <div className="max-w-3xl mx-auto">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="mr-1 h-3 w-3" />
            Early Access
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Free while we&apos;re in{" "}
            <span className="text-primary">early access</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            We&apos;re building ProjectStatus in the open. Everything is free
            right now — no credit card, no trial limits, no catch.
          </p>
        </div>
      </section>

      {/* Pricing Card */}
      <section className="px-4 pb-16">
        <div className="max-w-md mx-auto">
          <Card className="relative overflow-hidden border-primary/30 shadow-lg shadow-primary/5">
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl">Early Access</CardTitle>
              <div className="mt-4">
                <span className="text-5xl font-bold">$0</span>
                <span className="text-muted-foreground ml-1">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Full access to every feature, free forever during early access
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3 mb-8">
                {included.map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
              <Button className="w-full rounded-full h-11" asChild>
                <Link href="/">Get Started Free</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ-style section */}
      <section className="px-4 py-16 bg-muted/50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">
            Common questions
          </h2>
          <div className="space-y-8">
            <div>
              <h3 className="font-semibold mb-1">
                Will it always be free?
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                We plan to introduce paid tiers in the future for advanced
                features like white-label branding, priority support, and
                integrations. Users who sign up during early access will be
                grandfathered into generous free limits.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">
                Is there a limit on projects or team members?
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Not right now. During early access, everything is unlimited.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">
                Do I need a credit card to sign up?
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                No. Just create an account and start using ProjectStatus
                immediately.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">
                What happens to my data if pricing changes?
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your data is yours. You&apos;ll always be able to export it, and
                we&apos;ll give plenty of notice before any pricing changes take
                effect.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-6 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            <span>ProjectStatus</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/security/"
              className="hover:text-foreground transition-colors"
            >
              Security
            </Link>
            <Link
              href="/privacy/"
              className="hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms/"
              className="hover:text-foreground transition-colors"
            >
              Terms
            </Link>
          </div>
          <p>
            &copy; {new Date().getFullYear()} Sharp Tech Solutions. All rights
            reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
