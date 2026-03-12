import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Workflow,
  ArrowLeft,
  FileText,
  Handshake,
  Laptop,
  KeyRound,
  ShieldAlert,
  HardDrive,
  UserCog,
  Wifi,
  CreditCard,
  Trash2,
  AlertTriangle,
  FileWarning,
  RefreshCw,
  Landmark,
  Mail,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - ProjectStatus",
  description:
    "Terms and conditions for using the ProjectStatus project tracking platform.",
};

const sections = [
  {
    icon: Handshake,
    title: "1. Acceptance of Terms",
    content: (
      <p>
        By accessing or using ProjectStatus (the &quot;Service&quot;), operated
        by Sharp Tech Solutions (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), you
        agree to be bound by these Terms of Service. If you do not agree, do not
        use the Service.
      </p>
    ),
  },
  {
    icon: Laptop,
    title: "2. Description of Service",
    content: (
      <p>
        ProjectStatus is a web-based project tracking platform that allows
        organizations to create projects with customizable workflow stages,
        manage team members, and share progress with clients. The Service is
        currently offered free of charge during our early access period.
      </p>
    ),
  },
  {
    icon: KeyRound,
    title: "3. Accounts",
    content: (
      <ul className="space-y-2">
        <li className="flex items-start gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
          You must provide accurate and complete information when creating an account.
        </li>
        <li className="flex items-start gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
          You are responsible for maintaining the security of your account credentials.
        </li>
        <li className="flex items-start gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
          You must notify us immediately if you suspect unauthorized access to your account.
        </li>
        <li className="flex items-start gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
          One person or organization may not maintain multiple free accounts to circumvent limits.
        </li>
      </ul>
    ),
  },
  {
    icon: ShieldAlert,
    title: "4. Acceptable Use",
    content: (
      <div className="space-y-3">
        <p>You agree not to:</p>
        <ul className="space-y-2">
          <li className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            Use the Service for any unlawful purpose or in violation of any applicable laws
          </li>
          <li className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            Upload malicious files, viruses, or harmful content
          </li>
          <li className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            Attempt to gain unauthorized access to other users&apos; accounts or data
          </li>
          <li className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            Interfere with or disrupt the Service or its infrastructure
          </li>
          <li className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            Use automated tools to scrape, crawl, or extract data from the Service
          </li>
          <li className="flex items-start gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
            Resell, sublicense, or redistribute the Service without written permission
          </li>
        </ul>
      </div>
    ),
  },
  {
    icon: HardDrive,
    title: "5. Your Data",
    content: (
      <div className="space-y-3">
        <p>
          You retain ownership of all content and data you upload to
          ProjectStatus (&quot;Your Data&quot;). By using the Service, you grant
          us a limited license to host, store, and display Your Data solely for
          the purpose of providing the Service to you.
        </p>
        <p>
          We do not claim ownership of Your Data. We do not access, use, or
          share Your Data for any purpose other than operating the Service,
          unless required by law.
        </p>
      </div>
    ),
  },
  {
    icon: UserCog,
    title: "6. Organization Administrators",
    content: (
      <p>
        If you are an organization administrator (&quot;Admin&quot;), you are
        responsible for managing access within your organization. This includes
        inviting and removing team members, and ensuring your team&apos;s use
        complies with these terms. Admins may access and manage all project data
        within their organization.
      </p>
    ),
  },
  {
    icon: Wifi,
    title: "7. Service Availability",
    content: (
      <p>
        We strive to keep ProjectStatus available at all times, but we do not
        guarantee uninterrupted access. The Service may be temporarily
        unavailable due to maintenance, updates, or circumstances beyond our
        control. We are not liable for any loss or damage resulting from service
        interruptions.
      </p>
    ),
  },
  {
    icon: CreditCard,
    title: "8. Early Access & Pricing",
    content: (
      <p>
        ProjectStatus is currently in early access and is provided free of
        charge. We reserve the right to introduce paid plans in the future. We
        will provide at least 30 days&apos; notice before any pricing changes
        affect existing users.
      </p>
    ),
  },
  {
    icon: Trash2,
    title: "9. Termination",
    content: (
      <p>
        You may delete your account at any time. We may suspend or terminate
        your access if you violate these terms. Upon termination, we will delete
        your data in accordance with our{" "}
        <Link href="/privacy/" className="text-primary hover:underline font-medium">
          Privacy Policy
        </Link>.
      </p>
    ),
  },
  {
    icon: AlertTriangle,
    title: "10. Limitation of Liability",
    content: (
      <p>
        To the maximum extent permitted by law, Sharp Tech Solutions shall not be liable
        for any indirect, incidental, special, consequential, or punitive
        damages, or any loss of profits or revenue, whether incurred directly or
        indirectly, or any loss of data, use, goodwill, or other intangible
        losses resulting from your use of the Service.
      </p>
    ),
  },
  {
    icon: FileWarning,
    title: "11. Disclaimer of Warranties",
    content: (
      <p>
        The Service is provided &quot;as is&quot; and &quot;as available&quot;
        without warranties of any kind, whether express or implied, including but
        not limited to implied warranties of merchantability, fitness for a
        particular purpose, and non-infringement.
      </p>
    ),
  },
  {
    icon: RefreshCw,
    title: "12. Changes to Terms",
    content: (
      <p>
        We may update these terms from time to time. We will notify registered
        users of material changes via email at least 15 days before they take
        effect. Your continued use of the Service after changes constitutes
        acceptance of the updated terms.
      </p>
    ),
  },
  {
    icon: Landmark,
    title: "13. Governing Law",
    content: (
      <p>
        These terms shall be governed by and construed in accordance with the
        laws of the United States, without regard to conflict of law provisions.
      </p>
    ),
  },
  {
    icon: Mail,
    title: "14. Contact",
    content: (
      <p>
        Questions about these terms? Email us at{" "}
        <a href="mailto:support@sharptech.ai" className="text-primary hover:underline font-medium">
          support@sharptech.ai
        </a>.
      </p>
    ),
  },
];

export default function TermsPage() {
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
            <FileText className="mr-1 h-3 w-3" />
            Terms of Service
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Terms of <span className="text-primary">Service</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            By using ProjectStatus, you agree to these terms. Please read them
            carefully. Last updated: March 2025.
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
