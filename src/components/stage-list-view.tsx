"use client";

import { useMemo } from "react";
import type {
  ProjectStage,
  StageDependency,
  ClientVisibilitySettings,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  Pencil,
  UserPlus,
  Plus,
  Play,
  User,
  Trash2,
  Timer,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StageLayer {
  stages: ProjectStage[];
  isParallel: boolean;
}

interface StageListViewProps {
  stages: ProjectStage[];
  dependencies: StageDependency[];
  readOnly?: boolean;
  isAdmin?: boolean;
  isWorker?: boolean;
  userId?: string;
  workerNames?: Record<string, string>;
  progress?: number;
  visibilitySettings?: ClientVisibilitySettings | null;
  onUpdateStatus?: (stageId: string, status: ProjectStage["status"]) => void;
  onAddStage?: () => void;
  onEditStage?: (stageId: string) => void;
  onAssignWorker?: (stageId: string) => void;
  onRemoveStage?: (stageId: string) => void;
  timeByStage?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Layer computation
// ---------------------------------------------------------------------------

function computeStageLayers(
  stages: ProjectStage[],
  dependencies: StageDependency[]
): StageLayer[] {
  if (stages.length === 0) return [];

  if (dependencies.length > 0) {
    const stageIds = new Set(stages.map((s) => s.id));
    const predecessors = new Map<string, Set<string>>();
    const successors = new Map<string, Set<string>>();

    for (const s of stages) {
      predecessors.set(s.id, new Set());
      successors.set(s.id, new Set());
    }

    for (const dep of dependencies) {
      if (stageIds.has(dep.source_stage_id) && stageIds.has(dep.target_stage_id)) {
        predecessors.get(dep.target_stage_id)!.add(dep.source_stage_id);
        successors.get(dep.source_stage_id)!.add(dep.target_stage_id);
      }
    }

    const layerOf = new Map<string, number>();
    const queue: string[] = [];
    for (const s of stages) {
      if (predecessors.get(s.id)!.size === 0) {
        layerOf.set(s.id, 0);
        queue.push(s.id);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLayer = layerOf.get(current)!;
      for (const succ of successors.get(current)!) {
        const newLayer = currentLayer + 1;
        const existing = layerOf.get(succ);
        if (existing === undefined || newLayer > existing) {
          layerOf.set(succ, newLayer);
        }
        const allPredsAssigned = [...predecessors.get(succ)!].every((p) =>
          layerOf.has(p)
        );
        if (allPredsAssigned) {
          queue.push(succ);
        }
      }
    }

    for (const s of stages) {
      if (!layerOf.has(s.id)) {
        layerOf.set(s.id, s.position);
      }
    }

    const layerMap = new Map<number, ProjectStage[]>();
    for (const s of stages) {
      const layer = layerOf.get(s.id)!;
      if (!layerMap.has(layer)) layerMap.set(layer, []);
      layerMap.get(layer)!.push(s);
    }

    const sortedKeys = [...layerMap.keys()].sort((a, b) => a - b);
    return sortedKeys.map((key) => {
      const layerStages = layerMap.get(key)!.sort(
        (a, b) => a.position - b.position
      );
      return { stages: layerStages, isParallel: layerStages.length > 1 };
    });
  }

  const positionMap = new Map<number, ProjectStage[]>();
  for (const s of stages) {
    if (!positionMap.has(s.position)) positionMap.set(s.position, []);
    positionMap.get(s.position)!.push(s);
  }

  const sortedPositions = [...positionMap.keys()].sort((a, b) => a - b);
  return sortedPositions.map((pos) => {
    const group = positionMap.get(pos)!;
    return { stages: group, isParallel: group.length > 1 };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusIcon(status: ProjectStage["status"]) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />;
    case "in_progress":
      return <Clock className="h-5 w-5 text-blue-500 shrink-0" />;
    default:
      return (
        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/40 shrink-0" />
      );
  }
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StageRow({
  stage,
  stepLabel,
  readOnly,
  isAdmin,
  isWorker,
  userId,
  workerNames,
  visibilitySettings,
  onUpdateStatus,
  onEditStage,
  onAssignWorker,
  onRemoveStage,
  timeByStage,
}: {
  stage: ProjectStage;
  stepLabel: string;
  readOnly?: boolean;
  isAdmin?: boolean;
  isWorker?: boolean;
  userId?: string;
  workerNames?: Record<string, string>;
  visibilitySettings?: ClientVisibilitySettings | null;
  onUpdateStatus?: (stageId: string, status: ProjectStage["status"]) => void;
  onEditStage?: (stageId: string) => void;
  onAssignWorker?: (stageId: string) => void;
  onRemoveStage?: (stageId: string) => void;
  timeByStage?: Record<string, number>;
}) {
  const canAct =
    isAdmin ||
    (isWorker &&
      (!stage.assigned_to || stage.assigned_to === userId));

  const isClient = readOnly && !isAdmin && !isWorker;

  const showWorkerName =
    stage.assigned_to &&
    workerNames?.[stage.assigned_to] &&
    (!isClient || !visibilitySettings || visibilitySettings.show_worker_names);

  const showDates =
    !isClient || !visibilitySettings || visibilitySettings.show_estimated_completion;

  const time = timeByStage?.[stage.id];

  const dateLabel = showDates
    ? stage.planned_start && stage.estimated_completion
      ? `${formatDate(stage.planned_start)} – ${formatDate(stage.estimated_completion)}`
      : stage.estimated_completion
        ? `Est. ${formatDate(stage.estimated_completion)}`
        : stage.planned_start
          ? `Start ${formatDate(stage.planned_start)}`
          : null
    : null;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
        stage.status === "in_progress" &&
          "bg-blue-500/5 border border-blue-500/20",
        stage.status !== "in_progress" && "hover:bg-muted/50"
      )}
    >
      {/* Status icon */}
      {statusIcon(stage.status)}

      {/* Stage info */}
      <div className="flex-1 min-w-0">
        <span
          className={cn(
            "text-sm font-medium",
            stage.status === "completed" &&
              "line-through text-muted-foreground"
          )}
        >
          {stage.name}
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          {showWorkerName && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              {workerNames![stage.assigned_to!]}
            </span>
          )}
          {dateLabel && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {dateLabel}
            </span>
          )}
          {time != null && time > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Timer className="h-3 w-3" />
              {formatMinutes(time)}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {!readOnly && canAct && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {stage.status === "pending" && onUpdateStatus && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onUpdateStatus(stage.id, "in_progress")}
            >
              <Play className="h-3.5 w-3.5 mr-1" />
              Start
            </Button>
          )}
          {stage.status === "in_progress" && onUpdateStatus && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => onUpdateStatus(stage.id, "completed")}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Complete
            </Button>
          )}
          {isAdmin && onEditStage && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEditStage(stage.id)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {isAdmin && onAssignWorker && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onAssignWorker(stage.id)}
            >
              <UserPlus className="h-3.5 w-3.5" />
            </Button>
          )}
          {isAdmin && onRemoveStage && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={() => onRemoveStage(stage.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}

      {/* Step counter */}
      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
        {stepLabel}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function StageListView({
  stages,
  dependencies,
  readOnly,
  isAdmin,
  isWorker,
  userId,
  workerNames,
  progress,
  visibilitySettings,
  onUpdateStatus,
  onAddStage,
  onEditStage,
  onAssignWorker,
  onRemoveStage,
  timeByStage,
}: StageListViewProps) {
  const layers = useMemo(
    () => computeStageLayers(stages, dependencies),
    [stages, dependencies]
  );

  const completedCount = stages.filter((s) => s.status === "completed").length;
  const totalCount = stages.length;

  const pct =
    progress !== undefined
      ? progress
      : totalCount > 0
        ? Math.round((completedCount / totalCount) * 100)
        : 0;

  const estimatedCompletion = useMemo(() => {
    let latest: string | null = null;
    for (const s of stages) {
      if (s.estimated_completion) {
        if (!latest || s.estimated_completion > latest) {
          latest = s.estimated_completion;
        }
      }
    }
    return formatDate(latest);
  }, [stages]);

  const isClient = readOnly && !isAdmin && !isWorker;

  const showProgress =
    progress !== undefined &&
    (!isClient || !visibilitySettings || visibilitySettings.show_progress_percentage);

  const showEstimatedCompletion =
    estimatedCompletion &&
    (!isClient || !visibilitySettings || visibilitySettings.show_estimated_completion);

  let globalStep = 0;

  return (
    <div className="space-y-6">
      {/* -------- Progress Section -------- */}
      {(showProgress || showEstimatedCompletion) && (
        <div className="flex flex-col items-center gap-2 py-2">
          {showProgress && (
            <>
              <svg
                viewBox="0 0 36 36"
                className="h-14 w-14 -rotate-90"
              >
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  className="stroke-secondary"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  className="stroke-primary"
                  strokeWidth="3"
                  strokeDasharray={`${pct} ${100 - pct}`}
                  strokeLinecap="round"
                />
              </svg>
              <p className="text-sm text-muted-foreground">
                {completedCount} of {totalCount} stages complete
              </p>
            </>
          )}
          {showEstimatedCompletion && (
            <p className="text-xs text-muted-foreground">
              Estimated completion: {estimatedCompletion}
            </p>
          )}
        </div>
      )}

      {/* -------- Stage List -------- */}
      <div className="space-y-1">
        {layers.map((layer, layerIdx) => {
          if (!layer.isParallel) {
            const stage = layer.stages[0];
            globalStep++;
            const stepLabel = `${globalStep}/${totalCount}`;
            return (
              <StageRow
                key={stage.id}
                stage={stage}
                stepLabel={stepLabel}
                readOnly={readOnly}
                isAdmin={isAdmin}
                isWorker={isWorker}
                userId={userId}
                workerNames={workerNames}
                visibilitySettings={visibilitySettings}
                onUpdateStatus={onUpdateStatus}
                onEditStage={onEditStage}
                onAssignWorker={onAssignWorker}
                onRemoveStage={onRemoveStage}
                timeByStage={timeByStage}
              />
            );
          }

          return (
            <div key={`layer-${layerIdx}`} className="relative pl-4">
              {layer.stages.map((stage, stageIdx) => {
                globalStep++;
                const stepLabel = `${globalStep}/${totalCount}`;
                const isLast = stageIdx === layer.stages.length - 1;

                return (
                  <div key={stage.id} className="relative flex">
                    {/* Tree connector */}
                    <div className="absolute left-0 top-0 bottom-0 flex flex-col items-center w-4 -ml-4">
                      <div
                        className={cn(
                          "absolute left-[7px] top-0 w-0.5 bg-border",
                          isLast ? "h-[50%]" : "h-full"
                        )}
                      />
                      <div className="absolute left-[7px] top-[50%] w-[9px] h-0.5 bg-border" />
                    </div>

                    <div className="flex-1">
                      <StageRow
                        stage={stage}
                        stepLabel={stepLabel}
                        readOnly={readOnly}
                        isAdmin={isAdmin}
                        isWorker={isWorker}
                        userId={userId}
                        workerNames={workerNames}
                        visibilitySettings={visibilitySettings}
                        onUpdateStatus={onUpdateStatus}
                        onEditStage={onEditStage}
                        onAssignWorker={onAssignWorker}
                        onRemoveStage={onRemoveStage}
                        timeByStage={timeByStage}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* -------- Add Stage Button -------- */}
      {onAddStage && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={onAddStage}
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Stage
          </Button>
        </div>
      )}
    </div>
  );
}
