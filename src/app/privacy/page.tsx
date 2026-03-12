import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Workflow,
  ArrowLeft,
  Shield,
  User,
  Database,
  BarChart3,
  Server,
  Share2,
  Scale,
  Cookie,
  Clock,
  Baby,
  RefreshCw,
  Mail,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - ProjectStatus",
  description:
    "Learn how ProjectStatus collects, uses, and protects your personal information.",
};

const sections = [
  {
    icon: User,
    title: "1. Who We Are",
    content: (
      <p>
        ProjectStatus is operated by Sharp Tech Solutions (&quot;we&quot;,
        &quot;us&quot;, &quot;our&quot;). We provide a web-based project
        tracking platform that helps teams manage workflows and share progress
        with clients.
      </p>
    ),
  },
  {
    icon: Database,
    title: "2. Information We Collect",
    content: (
      <div className="space-y-4">
        <div>
          <h4 className="font-medium text-foreground mb-1">Account Information</h4>
          <p>
            When you create an account, we collect your email address and name.
            If you sign in with Google, we receive your name, email, and profile
            picture from Google.
          </p>
        </div>
        <div>
          <h4 className="font-medium text-foreground mb-1">Project Data</h4>
          <p>
            We store the projects, workflow stages, files, chat messages,
            calendar events, and other content you create within the platform.
            This data belongs to your organization.
          </p>
        </div>
        <div>
          <h4 className="font-medium text-foreground mb-1">Usage Data</h4>
          <p>
            We automatically collect basic usage information such as pages
            visited, browser type, and IP address to improve the service and
            diagnose issues.
          </p>
        </div>
      </div>
    ),
  },
  {
    icon: BarChart3,
    title: "3. How We Use Your Information",
    content: (
      <div className="space-y-3">
        <ul className="space-y-2">
          <li className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            To provide and maintain the ProjectStatus service
          </li>
          <li className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            To authenticate your identity and manage access
          </li>
          <li className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            To send transactional emails (invitations, notifications you opt into)
          </li>
          <li className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            To improve the platform and fix bugs
          </li>
          <li className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            To respond to support requests
          </li>
        </ul>
        <p>
          We do <strong className="text-foreground">not</strong> sell your personal data to third parties.
          We do <strong className="text-foreground">not</strong> use your project data for advertising.
        </p>
      </div>
    ),
  },
  {
    icon: Server,
    title: "4. Data Storage & Security",
    content: (
      <p>
        Your data is stored on Supabase (hosted on AWS) with AES-256 encryption
        at rest and TLS encryption in transit. We enforce row-level security
        policies so each organization&apos;s data is isolated at the database
        level. See our{" "}
        <Link href="/security/" className="text-primary hover:underline font-medium">
          Security page
        </Link>{" "}
        for details.
      </p>
    ),
  },
  {
    icon: Share2,
    title: "5. Third-Party Services",
    content: (
      <div className="space-y-3">
        <p>We use the following third-party services to operate ProjectStatus:</p>
        <ul className="space-y-2">
          <li className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span><strong className="text-foreground">Supabase</strong> — Database, authentication, and file storage</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span><strong className="text-foreground">Vercel</strong> — Application hosting and deployment</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span><strong className="text-foreground">Resend</strong> — Transactional email delivery</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span><strong className="text-foreground">Google OAuth</strong> — Optional sign-in provider</span>
          </li>
        </ul>
        <p>
          Each of these services has its own privacy policy. We only share the
          minimum data required for each service to function.
        </p>
      </div>
    ),
  },
  {
    icon: Scale,
    title: "6. Your Rights",
    content: (
      <div className="space-y-3">
        <p>You have the right to:</p>
        <ul className="space-y-2">
          <li className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span><strong className="text-foreground">Access</strong> your personal data stored in our systems</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span><strong className="text-foreground">Correct</strong> inaccurate information in your profile</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span><strong className="text-foreground">Delete</strong> your account and all associated data</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            <span><strong className="text-foreground">Export</strong> your data upon request</span>
          </li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{" "}
          <a href="mailto:support@sharptech.ai" className="text-primary hover:underline font-medium">
            support@sharptech.ai
          </a>.
        </p>
      </div>
    ),
  },
  {
    icon: Cookie,
    title: "7. Cookies",
    content: (
      <p>
        We use essential cookies only — for authentication sessions and theme
        preferences. We do not use advertising or third-party tracking cookies.
      </p>
    ),
  },
  {
    icon: Clock,
    title: "8. Data Retention",
    content: (
      <p>
        We retain your data for as long as your account is active. When you
        delete your account or organization, we permanently delete all associated
        data within 30 days. Backup copies are purged within 90 days.
      </p>
    ),
  },
  {
    icon: Baby,
    title: "9. Children's Privacy",
    content: (
      <p>
        ProjectStatus is not directed at children under 13. We do not knowingly
        collect personal information from children.
      </p>
    ),
  },
  {
    icon: RefreshCw,
    title: "10. Changes to This Policy",
    content: (
      <p>
        We may update this policy from time to time. We will notify registered
        users of material changes via email. Your continued use of the service
        after changes constitutes acceptance.
      </p>
    ),
  },
  {
    icon: Mail,
    title: "11. Contact",
    content: (
      <p>
        If you have questions about this privacy policy, email us at{" "}
        <a href="mailto:support@sharptech.ai" className="text-primary hover:underline font-medium">
          support@sharptech.ai
        </a>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
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
            <Shield className="mr-1 h-3 w-3" />
            Privacy Policy
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Your privacy <span className="text-primary">matters</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            This policy explains what data we collect, how we use it, and the
            choices you have. Last updated: March 2025.
          </p>
        </div>
      </section>

      {/* Content Cards */}
      <section className="px-4 pb-16">
        <div className="max-w-4xl mx-auto grid grid-cols-1 gap-5">
          {sections.map((s) => (
            <Card key={s.title} className="transition-shadow hover:shadow-lg">
              <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{s.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-relaxed">
                {s.content}
              </CardContent>
            </Card>
          ))}
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
