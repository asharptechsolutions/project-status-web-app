"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Lock,
  Eye,
  Server,
  FileKey,
  MessageSquareLock,
  Trash2,
  UserCheck,
  ArrowLeft,
  Workflow,
} from "lucide-react";

const sections = [
  {
    icon: Lock,
    title: "Encryption in Transit",
    description:
      "All connections to ProjectStatus use TLS/HTTPS encryption. Every request between your browser and our servers is encrypted, preventing eavesdropping and man-in-the-middle attacks.",
  },
  {
    icon: Server,
    title: "Encryption at Rest",
    description:
      "Your data is encrypted at rest using AES-256 encryption via Google Cloud and Firebase infrastructure. This ensures your project data remains protected even at the storage level.",
  },
  {
    icon: UserCheck,
    title: "Access Controls",
    description:
      "Only approved contacts can view your projects. Access is controlled through email verification, ensuring that only the people you explicitly invite can see your project details.",
  },
  {
    icon: FileKey,
    title: "File Storage Security",
    description:
      "All files uploaded to ProjectStatus are stored in Firebase Storage with built-in encryption. Access is governed by security rules that enforce per-user data isolation.",
  },
  {
    icon: MessageSquareLock,
    title: "Chat Message Security",
    description:
      "Project chat messages are encrypted both in transit and at rest. Conversations stay private between authorized project participants only.",
  },
  {
    icon: Eye,
    title: "No Third-Party Data Sharing",
    description:
      "We do not sell, share, or provide your data to third parties. Your project information, files, and communications remain exclusively yours.",
  },
  {
    icon: Trash2,
    title: "Data Retention & Deletion",
    description:
      "You are in full control of your data. When you delete a project, all associated data — including stages, files, chat messages, and tracking links — is permanently removed.",
  },
  {
    icon: Shield,
    title: "Google Cloud Infrastructure",
    description:
      "ProjectStatus is hosted entirely on Google Cloud infrastructure, benefiting from Google's world-class security practices, certifications (SOC 1/2/3, ISO 27001), and global reliability.",
  },
];

export default function SecurityPage() {
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
            Security &amp; Privacy
          </Badge>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            Your data security is our{" "}
            <span className="text-primary">top priority</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            ProjectStatus is built with security at every layer. From encryption
            to access controls, here&apos;s how we keep your projects safe.
          </p>
        </div>
      </section>

      {/* Security Cards */}
      <section className="px-4 pb-16">
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
          {sections.map((s) => (
            <Card key={s.title} className="transition-shadow hover:shadow-lg">
              <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-lg">{s.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {s.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Questions CTA */}
      <section className="px-4 py-16 bg-muted/50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-3">Have security questions?</h2>
          <p className="text-muted-foreground mb-6">
            We take security seriously. If you have any questions or concerns
            about how your data is handled, please reach out to us.
          </p>
          <Button asChild>
            <a href="mailto:support@sharptech.ai">Contact Us</a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-6 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            <span>ProjectStatus</span>
          </div>
          <p>
            &copy; {new Date().getFullYear()} SharpTech.ai. All rights
            reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
