"use client";

import { Navbar } from "@/components/navbar";
import { Globe, ExternalLink } from "lucide-react";

const websites = [
  {
    name: "SpotBookie",
    url: "https://asharptechsolutions.github.io/stylist-scheduler/",
    description: "Multi-tenant booking SaaS platform for service businesses",
    color: "from-blue-500 to-cyan-500",
  },
  {
    name: "Job Finder",
    url: "https://asharptechsolutions.github.io/job-finder/",
    description: "AI-powered job matching with resume builder and skill analysis",
    color: "from-emerald-500 to-teal-500",
  },
  {
    name: "BetBuddy",
    url: "https://asharptechsolutions.github.io/prediction-market/",
    description: "Prediction market platform for friendly wagering",
    color: "from-purple-500 to-pink-500",
  },
  {
    name: "HireArena",
    url: "https://asharptechsolutions.github.io/hiring-contests/",
    description: "Competitive hiring platform with contest-based recruitment",
    color: "from-orange-500 to-red-500",
  },
  {
    name: "Homeschool AI",
    url: "https://asharptechsolutions.github.io/homeschool-ai/",
    description: "AI-powered curriculum and lesson planning for homeschoolers",
    color: "from-yellow-500 to-amber-500",
  },
  {
    name: "Accelemate",
    url: "https://asharptechsolutions.github.io/accelemate/",
    description: "Accelerator program discovery and application tracker",
    color: "from-indigo-500 to-violet-500",
  },
  {
    name: "SharpTech.ai",
    url: "https://asharptechsolutions.github.io/sharptech-website/",
    description: "Company website with portfolio, blog, and contact",
    color: "from-slate-500 to-zinc-500",
  },
  {
    name: "ProjectStatus",
    url: "https://projectstatus.app",
    description: "Visual project tracking with workflow canvas and client access",
    color: "from-sky-500 to-blue-500",
  },
  {
    name: "Command Center",
    url: "https://asharptechsolutions.github.io/idea-command-center/",
    description: "Idea review pipeline and autonomous app factory dashboard",
    color: "from-rose-500 to-fuchsia-500",
  },
];

export default function WebsitesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center gap-3 mb-8">
          <Globe className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Websites</h1>
            <p className="text-muted-foreground text-sm">All deployed SharpTech applications</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {websites.map((site) => (
            <a
              key={site.name}
              href={site.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-xl border bg-card overflow-hidden shadow-sm hover:shadow-lg transition-all hover:-translate-y-1"
            >
              {/* Gradient preview header */}
              <div className={`h-32 bg-gradient-to-br ${site.color} flex items-center justify-center`}>
                <span className="text-white text-2xl font-bold drop-shadow-md group-hover:scale-105 transition-transform">
                  {site.name}
                </span>
              </div>
              {/* Card body */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-semibold text-sm">{site.name}</h2>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{site.description}</p>
              </div>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
