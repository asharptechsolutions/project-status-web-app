"use client";
import { useMemo } from "react";
import { predictProjectEta, formatEtaBand, type DurationModel } from "@/lib/eta";
import type { ProjectStage, StageDependency } from "@/lib/types";
import { CalendarClock, TrendingUp, TrendingDown, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EtaBadgeProps {
  stages: ProjectStage[];
  dependencies: StageDependency[];
  model: DurationModel | null;
  /** Compact inline form (for cards/lists) vs the full hero card */
  variant?: "inline" | "card";
  className?: string;
}

const CONFIDENCE_LABEL: Record<string, string> = {
  high: "Based on your shop's history",
  medium: "Estimated from limited history",
  low: "Rough estimate — needs more history",
};

export function EtaBadge({ stages, dependencies, model, variant = "inline", className }: EtaBadgeProps) {
  const eta = useMemo(
    () => (model ? predictProjectEta(stages, dependencies, model) : null),
    [stages, dependencies, model]
  );

  if (!eta || eta.done) return null;

  const band = formatEtaBand(eta);
  const slip = eta.slipDays;

  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <CalendarClock className="h-3.5 w-3.5" />
        <span>Ready <span className="font-medium text-foreground">{band}</span></span>
        {slip !== null && slip < 0 && (
          <span className="text-red-600 dark:text-red-400">({Math.abs(slip)}d late)</span>
        )}
      </span>
    );
  }

  return (
    <div className={cn("rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-4", className)}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarClock className="h-4 w-4" />
        <span>Estimated ready date</span>
      </div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{band}</div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-muted-foreground">{CONFIDENCE_LABEL[eta.confidence]}</span>
        {slip !== null && slip > 0 && (
          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
            <TrendingUp className="h-3.5 w-3.5" /> {slip}d ahead of plan
          </span>
        )}
        {slip !== null && slip < 0 && (
          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
            <TrendingDown className="h-3.5 w-3.5" /> {Math.abs(slip)}d behind plan
          </span>
        )}
        {slip === 0 && (
          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> On track
          </span>
        )}
      </div>
    </div>
  );
}
