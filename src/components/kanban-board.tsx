"use client";

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
  GripVertical,
  User,
  Trash2,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";

interface KanbanBoardProps {
  stages: ProjectStage[];
  dependencies: StageDependency[];
  readOnly?: boolean;
  isAdmin?: boolean;
  isWorker?: boolean;
  userId?: string;
  workerNames?: Record<string, string>;
  progress?: number;
  visibilitySettings?: ClientVisibilitySettings | null;
  onUpdateStatus?: (
    stageId: string,
    status: ProjectStage["status"]
  ) => void;
  onAddStage?: () => void;
  onEditStage?: (stageId: string) => void;
  onAssignWorker?: (stageId: string) => void;
  onRemoveStage?: (stageId: string) => void;
  timeByStage?: Record<string, number>;
}

const columns = [
  {
    key: "pending" as const,
    title: "Pending",
    color: "text-muted-foreground",
    bg: "bg-muted/50",
  },
  {
    key: "in_progress" as const,
    title: "In Progress",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/5",
  },
  {
    key: "completed" as const,
    title: "Completed",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-500/5",
  },
];

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function KanbanBoard({
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
}: KanbanBoardProps) {
  const isClient = readOnly && !isAdmin && !isWorker;

  const showWorkerNames =
    !isClient || !visibilitySettings || visibilitySettings.show_worker_names;
  const showEstimatedCompletion =
    !isClient ||
    !visibilitySettings ||
    visibilitySettings.show_estimated_completion;
  const showProgress =
    progress !== undefined &&
    (!isClient ||
      !visibilitySettings ||
      visibilitySettings.show_progress_percentage);

  function canAct(stage: ProjectStage): boolean {
    if (readOnly) return false;
    if (isAdmin) return true;
    if (isWorker) {
      return !stage.assigned_to || stage.assigned_to === userId;
    }
    return false;
  }

  function getStagesForColumn(status: ProjectStage["status"]) {
    return stages
      .filter((s) => s.status === status)
      .sort((a, b) => a.position - b.position);
  }

  function handleDragEnd(result: DropResult) {
    if (!result.destination || readOnly) return;
    const stageId = result.draggableId;
    const destColumn = result.destination.droppableId as ProjectStage["status"];
    const stage = stages.find((s) => s.id === stageId);
    if (!stage || stage.status === destColumn) return;
    if (!canAct(stage) || !onUpdateStatus) return;

    // Only allow valid status transitions
    // pending → in_progress, in_progress → completed, or reverse
    const validTransitions: Record<string, string[]> = {
      pending: ["in_progress"],
      in_progress: ["pending", "completed"],
      completed: ["in_progress"],
    };
    if (!validTransitions[stage.status]?.includes(destColumn)) return;

    onUpdateStatus(stageId, destColumn);
  }

  const content = (
    <div className="space-y-3">
      {/* Progress bar */}
      {showProgress && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="bg-secondary rounded-full h-2">
            <div
              className="bg-primary rounded-full h-2 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Kanban columns */}
      <div className="grid grid-cols-3 gap-3">
        {columns.map((col) => {
          const colStages = getStagesForColumn(col.key);

          return (
            <Droppable droppableId={col.key} key={col.key}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "rounded-lg border p-3 flex flex-col transition-colors",
                    col.bg,
                    snapshot.isDraggingOver && "ring-2 ring-primary/30"
                  )}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-3">
                    <h4
                      className={cn(
                        "text-xs font-semibold uppercase tracking-wider",
                        col.color
                      )}
                    >
                      {col.title}
                    </h4>
                    <span className="text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                      {colStages.length}
                    </span>
                  </div>

                  {/* Stage cards */}
                  <div className="space-y-2 flex-1 overflow-y-auto max-h-[60vh]">
                    {colStages.map((stage, index) => {
                      const workerName =
                        stage.assigned_to && workerNames
                          ? workerNames[stage.assigned_to]
                          : null;
                      const actable = canAct(stage);
                      const time = timeByStage?.[stage.id];

                      return (
                        <Draggable
                          key={stage.id}
                          draggableId={stage.id}
                          index={index}
                          isDragDisabled={readOnly || !actable}
                        >
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={cn(
                                "group rounded-md border bg-card p-3 shadow-sm",
                                dragSnapshot.isDragging && "shadow-lg ring-2 ring-primary/30"
                              )}
                            >
                              {/* Card header row */}
                              <div className="flex items-start gap-2">
                                <div
                                  {...dragProvided.dragHandleProps}
                                  className={cn(
                                    "mt-0.5 shrink-0",
                                    readOnly || !actable
                                      ? "cursor-default"
                                      : "cursor-grab active:cursor-grabbing"
                                  )}
                                >
                                  <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm">
                                    {stage.name}
                                  </p>

                                  {/* Worker name */}
                                  {workerName && showWorkerNames && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <User className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground truncate">
                                        {workerName}
                                      </span>
                                    </div>
                                  )}

                                  {/* Estimated completion */}
                                  {stage.estimated_completion &&
                                    showEstimatedCompletion && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Est. {formatDate(stage.estimated_completion)}
                                      </p>
                                    )}

                                  {/* Time tracking */}
                                  {time != null && time > 0 && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <Timer className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground">
                                        {formatMinutes(time)}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Admin action icons (visible on hover) */}
                                {!readOnly && isAdmin && (
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => onEditStage?.(stage.id)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() =>
                                        onAssignWorker?.(stage.id)
                                      }
                                    >
                                      <UserPlus className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive"
                                      onClick={() =>
                                        onRemoveStage?.(stage.id)
                                      }
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {/* Status action buttons */}
                              {!readOnly && actable && (
                                <div className="mt-2">
                                  {stage.status === "pending" && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs w-full"
                                      onClick={() =>
                                        onUpdateStatus?.(
                                          stage.id,
                                          "in_progress"
                                        )
                                      }
                                    >
                                      <Play className="h-3.5 w-3.5 mr-1" />
                                      Start
                                    </Button>
                                  )}
                                  {stage.status === "in_progress" && (
                                    <Button
                                      size="sm"
                                      className="h-7 text-xs w-full bg-blue-600 hover:bg-blue-700 text-white"
                                      onClick={() =>
                                        onUpdateStatus?.(
                                          stage.id,
                                          "completed"
                                        )
                                      }
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                      Complete
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}

                    {/* Add stage button in pending column */}
                    {col.key === "pending" &&
                      !readOnly &&
                      isAdmin &&
                      onAddStage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full border border-dashed text-muted-foreground h-8 text-xs"
                          onClick={onAddStage}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Add Stage
                        </Button>
                      )}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </div>
  );

  if (readOnly) {
    // Wrap in DragDropContext even for read-only (DnD is disabled per-item)
    return (
      <DragDropContext onDragEnd={() => {}}>
        {content}
      </DragDropContext>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      {content}
    </DragDropContext>
  );
}
