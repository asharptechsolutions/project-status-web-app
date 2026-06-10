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
    "Simple pricing for teams of every size. Start free, upgrade to Pro when you need more.",
};

const freeFeatures = [
  { icon: FolderOpen, text: "Up to 3 active projects" },
  { icon: Users, text: "Up to 5 team members" },
  { icon: Globe, text: "Client tracking portal" },
  { icon: Zap, text: "Workflow templates" },
  { icon: MessageSquare, text: "Project chat" },
  { icon: Upload, text: "File uploads" },
];

const proFeatures = [
  { icon: FolderOpen, text: "Unlimited projects" },
  { icon: Users, text: "Unlimited team members" },
  { icon: Globe, text: "Client tracking portal & share links" },
  { icon: Zap, text: "Workflow automations & QR stage tracking" },
  { icon: BarChart3, text: "Time tracking & progress dashboards" },
  { icon: MessageSquare, text: "End-to-end encrypted chat" },
  { icon: CalendarDays, text: "Scheduling, booking & video calls" },
  { icon: Upload, text: "Branded client emails" },
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
            Simple pricing
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Start free, upgrade when{" "}
            <span className="text-primary">you grow</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Every plan includes the client tracking portal that cuts down
            &quot;where&apos;s my order?&quot; calls. No credit card required to start.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="px-4 pb-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="relative overflow-hidden">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl">Free</CardTitle>
              <div className="mt-4">
                <span className="text-5xl font-bold">$0</span>
                <span className="text-muted-foreground ml-1">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                For small shops getting started
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3 mb-8">
                {freeFeatures.map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-muted-foreground" />
                    </div>
                    <span className="text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full rounded-full h-11" asChild>
                <Link href="/">Get Started Free</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-primary/30 shadow-lg shadow-primary/5">
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
            <CardHeader className="text-center pb-2">
              <Badge className="absolute top-4 right-4">Most popular</Badge>
              <CardTitle className="text-2xl">Pro</CardTitle>
              <div className="mt-4">
                <span className="text-5xl font-bold">$29</span>
                <span className="text-muted-foreground ml-1">/month</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Everything unlimited, per organization
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3 mb-8">
                {proFeatures.map((item) => (
                  <div key={item.text} className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
              <Button className="w-full rounded-full h-11" asChild>
                <Link href="/">Start with Pro</Link>
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                Upgrade any time from Settings → Billing
              </p>
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
                How do I upgrade to Pro?
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Create your organization on the free plan, then the account
                owner can upgrade any time from Settings → Billing. Payments
                are handled securely by Stripe.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">
                Can I cancel any time?
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Yes. Manage or cancel your subscription from the billing
                portal — you keep Pro until the end of the period you&apos;ve
                paid for, then move back to the free plan.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">
                Do I need a credit card to sign up?
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                No. Just create an account and start using ProjectStatus
                immediately on the free plan.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">
                What happens to my data if I downgrade?
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your data is yours. Nothing is deleted when you change plans,
                and you can export your data at any time.
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
