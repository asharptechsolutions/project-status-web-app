"use client";
import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondaryAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Icon className="h-7 w-7 text-muted-foreground/60" />
        </div>
        <h3 className="text-lg font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">{description}</p>
        {actionLabel && onAction && (
          <Button onClick={onAction}>{actionLabel}</Button>
        )}
        {secondaryLabel && onSecondaryAction && (
          <button
            onClick={onSecondaryAction}
            className="mt-3 text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
          >
            {secondaryLabel}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
