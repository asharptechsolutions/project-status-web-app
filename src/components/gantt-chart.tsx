"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  differenceInDays,
  addDays,
  startOfDay,
  format,
  isMonday,
  isSameDay,
  parseISO,
} from "date-fns";
import type { ProjectStage, StageDependency, ClientVisibilitySettings } from "@/lib/types";
import { CheckCircle2, Clock, Loader2, User, Calendar, Pencil, Plus } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface GanttChartProps {
  stages: ProjectStage[];
  dependencies: StageDependency[];
  readOnly?: boolean;
  isAdmin?: boolean;
  isWorker?: boolean;
  workerNames?: Record<string, string>;
  progress?: number;
  visibilitySettings?: ClientVisibilitySettings | null;
  onUpdateStage?: (stageId: string, updates: Partial<ProjectStage>) => void;
  onAddStage?: () => void;
  onEditStage?: (stageId: string) => void;
  onAddDependency?: (sourceId: string, targetId: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 52;
const LABEL_WIDTH = 200;
const MIN_COL_WIDTH = 36;
const BAR_HEIGHT = 28;
const BAR_Y_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2;
const CONNECTOR_SIZE = 10;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getStatusColor(status: ProjectStage["status"]) {
  switch (status) {
    case "completed":
      return { bg: "rgb(34 197 94)", bgDark: "rgb(22 163 74)", text: "text-green-700 dark:text-green-400" };
    case "in_progress":
      return { bg: "rgb(59 130 246)", bgDark: "rgb(37 99 235)", text: "text-blue-700 dark:text-blue-400" };
    default:
      return { bg: "rgb(156 163 175)", bgDark: "rgb(107 114 128)", text: "text-muted-foreground" };
  }
}

function parseDate(d: string | null): Date | null {
  if (!d) return null;
  try {
    return startOfDay(parseISO(d));
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function GanttChart({
  stages,
  dependencies,
  readOnly = false,
  isAdmin = false,
  isWorker = false,
  workerNames,
  progress,
  visibilitySettings,
  onUpdateStage,
  onAddStage,
  onEditStage,
  onAddDependency,
}: GanttChartProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const chartAreaRef = useRef<HTMLDivElement>(null);

  // -- Drag state: use refs for smooth pixel-level tracking --
  const [dragState, setDragState] = useState<{
    stageId: string;
    edge: "start" | "end" | "move";
    initialX: number;
    initialStart: Date;
    initialEnd: Date;
  } | null>(null);
  const dragPixelOffset = useRef(0);
  const dragDays = useRef(0);
  const [, setRenderTick] = useState(0);
  const rafId = useRef<number | null>(null);

  // Optimistic pending updates to avoid snap-back
  const pendingUpdates = useRef<Map<string, { planned_start: string; estimated_completion: string }>>(new Map());
  const prevStagesRef = useRef(stages);

  // Clear pending updates when stage data arrives from parent
  useEffect(() => {
    if (stages !== prevStagesRef.current) {
      for (const [stageId, pending] of pendingUpdates.current.entries()) {
        const stage = stages.find((s) => s.id === stageId);
        if (stage && stage.planned_start === pending.planned_start && stage.estimated_completion === pending.estimated_completion) {
          pendingUpdates.current.delete(stageId);
        }
      }
      prevStagesRef.current = stages;
    }
  }, [stages]);

  // -- Link-drag state for drawing dependencies --
  const [linkDrag, setLinkDrag] = useState<{
    sourceId: string;
    sourceX: number;
    sourceY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [linkHoverTarget, setLinkHoverTarget] = useState<string | null>(null);

  // Visibility flags
  const hideWorkerName = visibilitySettings?.show_worker_names === false;
  const hideEstCompletion = visibilitySettings?.show_estimated_completion === false;
  const hideProgress = visibilitySettings?.show_progress_percentage === false;

  // Sort stages by position
  const sorted = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages],
  );

  // Separate scheduled vs unscheduled (apply pending updates for scheduling check)
  const scheduled = useMemo(
    () => sorted.filter((s) => {
      const pending = pendingUpdates.current.get(s.id);
      if (pending) return true;
      return s.planned_start || s.estimated_completion;
    }),
    [sorted],
  );
  const unscheduled = useMemo(
    () => sorted.filter((s) => {
      const pending = pendingUpdates.current.get(s.id);
      if (pending) return false;
      return !s.planned_start && !s.estimated_completion;
    }),
    [sorted],
  );

  // Compute timeline range
  const { timelineStart, totalDays, useWeeks } = useMemo(() => {
    const today = startOfDay(new Date());
    let minDate = today;
    let maxDate = addDays(today, 14);

    for (const s of scheduled) {
      const pending = pendingUpdates.current.get(s.id);
      const ps = parseDate(pending?.planned_start ?? s.planned_start);
      const ec = parseDate(pending?.estimated_completion ?? s.estimated_completion);
      const sa = parseDate(s.started_at);
      const ca = parseDate(s.completed_at);
      for (const d of [ps, ec, sa, ca]) {
        if (d) {
          if (d < minDate) minDate = d;
          if (d > maxDate) maxDate = d;
        }
      }
    }

    const start = addDays(minDate, -2);
    const end = addDays(maxDate, 3);
    const days = differenceInDays(end, start) + 1;
    const weeks = days > 60;

    return { timelineStart: start, timelineEnd: end, totalDays: days, useWeeks: weeks };
  }, [scheduled]);

  // Column width based on total days
  const colWidth = useMemo(() => {
    if (useWeeks) return Math.max(MIN_COL_WIDTH, 20);
    return Math.max(MIN_COL_WIDTH, 36);
  }, [useWeeks]);

  const chartWidth = totalDays * colWidth;

  // Date columns
  const dateColumns = useMemo(() => {
    const cols: { date: Date; label: string; isToday: boolean; showLabel: boolean }[] = [];
    const today = startOfDay(new Date());
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(timelineStart, i);
      const isToday = isSameDay(d, today);
      let showLabel = true;
      if (useWeeks) {
        showLabel = isMonday(d) || i === 0;
      }
      cols.push({
        date: d,
        label: format(d, useWeeks ? "MMM d" : "d"),
        isToday,
        showLabel,
      });
    }
    return cols;
  }, [timelineStart, totalDays, useWeeks]);

  // Today marker position
  const todayOffset = useMemo(() => {
    const today = startOfDay(new Date());
    const days = differenceInDays(today, timelineStart);
    if (days < 0 || days > totalDays) return null;
    return days * colWidth + colWidth / 2;
  }, [timelineStart, totalDays, colWidth]);

  // Get bar position for a stage (uses pending updates if available)
  const getBarBounds = useCallback(
    (stage: ProjectStage) => {
      const pending = pendingUpdates.current.get(stage.id);
      const ps = parseDate(pending?.planned_start ?? stage.planned_start);
      const ec = parseDate(pending?.estimated_completion ?? stage.estimated_completion);
      if (!ps && !ec) return null;

      const barStart = ps || ec!;
      const barEnd = ec || ps!;
      const startDay = differenceInDays(barStart, timelineStart);
      const endDay = differenceInDays(barEnd, timelineStart);
      const x = startDay * colWidth;
      const width = Math.max((endDay - startDay + 1) * colWidth, colWidth);

      return { x, width, startDate: barStart, endDate: barEnd };
    },
    [timelineStart, colWidth],
  );

  // Drag handlers
  const canDrag = !readOnly && isAdmin && onUpdateStage;

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, stageId: string, edge: "start" | "end" | "move") => {
      if (!canDrag) return;
      e.preventDefault();
      e.stopPropagation();
      const stage = sorted.find((s) => s.id === stageId);
      if (!stage) return;
      const pending = pendingUpdates.current.get(stageId);
      const ps = parseDate(pending?.planned_start ?? stage.planned_start) || startOfDay(new Date());
      const ec = parseDate(pending?.estimated_completion ?? stage.estimated_completion) || ps;
      dragPixelOffset.current = 0;
      dragDays.current = 0;
      setDragState({ stageId, edge, initialX: e.clientX, initialStart: ps, initialEnd: ec });
    },
    [canDrag, sorted],
  );

  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      dragPixelOffset.current = e.clientX - dragState.initialX;
      dragDays.current = Math.round(dragPixelOffset.current / colWidth);
      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(() => {
          rafId.current = null;
          setRenderTick((t) => t + 1);
        });
      }
    };

    const handleMouseUp = () => {
      const daysDelta = dragDays.current;
      if (daysDelta !== 0 && onUpdateStage) {
        const { stageId, edge, initialStart, initialEnd } = dragState;
        let newStart = initialStart;
        let newEnd = initialEnd;

        if (edge === "start") {
          newStart = addDays(initialStart, daysDelta);
          if (newStart > newEnd) newStart = newEnd;
        } else if (edge === "end") {
          newEnd = addDays(initialEnd, daysDelta);
          if (newEnd < newStart) newEnd = newStart;
        } else {
          newStart = addDays(initialStart, daysDelta);
          newEnd = addDays(initialEnd, daysDelta);
        }

        const planned_start = format(newStart, "yyyy-MM-dd");
        const estimated_completion = format(newEnd, "yyyy-MM-dd");

        // Store optimistic position to prevent snap-back
        pendingUpdates.current.set(stageId, { planned_start, estimated_completion });

        onUpdateStage(stageId, { planned_start, estimated_completion });
      }

      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      dragPixelOffset.current = 0;
      dragDays.current = 0;
      setDragState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };
  }, [dragState, colWidth, onUpdateStage]);

  // Link drag handlers for drawing dependencies
  const canLink = !readOnly && isAdmin && !!onAddDependency;

  const handleConnectorMouseDown = useCallback(
    (e: React.MouseEvent, stageId: string, barRightX: number, barCenterY: number) => {
      if (!canLink) return;
      e.preventDefault();
      e.stopPropagation();
      const chartRect = chartAreaRef.current?.getBoundingClientRect();
      if (!chartRect) return;
      setLinkDrag({
        sourceId: stageId,
        sourceX: barRightX,
        sourceY: barCenterY,
        currentX: barRightX,
        currentY: barCenterY,
      });
    },
    [canLink],
  );

  useEffect(() => {
    if (!linkDrag) return;

    const handleMouseMove = (e: MouseEvent) => {
      const chartRect = chartAreaRef.current?.getBoundingClientRect();
      const scrollEl = scrollRef.current;
      if (!chartRect || !scrollEl) return;
      const x = e.clientX - chartRect.left + scrollEl.scrollLeft;
      const y = e.clientY - chartRect.top + scrollEl.scrollTop;
      setLinkDrag((prev) => prev ? { ...prev, currentX: x, currentY: y } : null);

      // Hit-test bars for hover target
      const rowIdx = Math.floor(y / ROW_HEIGHT);
      if (rowIdx >= 0 && rowIdx < scheduled.length) {
        const target = scheduled[rowIdx];
        if (target.id !== linkDrag.sourceId) {
          const bounds = getBarBounds(target);
          if (bounds && x >= bounds.x && x <= bounds.x + bounds.width) {
            setLinkHoverTarget(target.id);
            return;
          }
        }
      }
      setLinkHoverTarget(null);
    };

    const handleMouseUp = () => {
      if (linkHoverTarget && onAddDependency) {
        onAddDependency(linkDrag.sourceId, linkHoverTarget);
      }
      setLinkDrag(null);
      setLinkHoverTarget(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [linkDrag, linkHoverTarget, scheduled, getBarBounds, onAddDependency]);

  // Month headers
  const monthHeaders = useMemo(() => {
    const headers: { label: string; startCol: number; span: number }[] = [];
    let currentMonth = "";
    let startCol = 0;
    let span = 0;
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(timelineStart, i);
      const month = format(d, "MMM yyyy");
      if (month !== currentMonth) {
        if (currentMonth) headers.push({ label: currentMonth, startCol, span });
        currentMonth = month;
        startCol = i;
        span = 1;
      } else {
        span++;
      }
    }
    if (currentMonth) headers.push({ label: currentMonth, startCol, span });
    return headers;
  }, [timelineStart, totalDays]);

  // Interactive features available?
  const canEdit = !readOnly && !!onEditStage;
  const canAdd = !readOnly && !!onAddStage;

  // Collect all bar bounding boxes for collision detection (must be before early return)
  const allBarBounds = useMemo(() => {
    return scheduled.map((s, i) => {
      const b = getBarBounds(s);
      return b ? { row: i, x: b.x, width: b.width, right: b.x + b.width } : null;
    }).filter(Boolean) as { row: number; x: number; width: number; right: number }[];
  }, [scheduled, getBarBounds]);

  // No scheduled stages
  if (scheduled.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <Calendar className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">
          Set planned start and estimated completion dates on stages to see the timeline.
        </p>
        {unscheduled.length > 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            {unscheduled.length} unscheduled stage{unscheduled.length !== 1 ? "s" : ""}
          </p>
        )}
        {canAdd && (
          <button
            onClick={onAddStage}
            className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Stage
          </button>
        )}
      </div>
    );
  }

  const chartHeight = scheduled.length * ROW_HEIGHT;

  // Build dependency arrow paths with smart routing
  const ARROW_MARGIN = 14;
  const CORNER_R = 5;

  // Helper: build rounded-corner orthogonal path from a list of waypoints
  function buildRoundedPath(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return "";
    const parts: string[] = [`M ${pts[0].x} ${pts[0].y}`];
    for (let i = 1; i < pts.length - 1; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const next = pts[i + 1];
      // Direction vectors
      const dx1 = Math.sign(curr.x - prev.x);
      const dy1 = Math.sign(curr.y - prev.y);
      const dx2 = Math.sign(next.x - curr.x);
      const dy2 = Math.sign(next.y - curr.y);
      // Only round if there's an actual turn
      if (dx1 === dx2 && dy1 === dy2) {
        parts.push(`L ${curr.x} ${curr.y}`);
        continue;
      }
      const segLen1 = Math.abs(curr.x - prev.x) + Math.abs(curr.y - prev.y);
      const segLen2 = Math.abs(next.x - curr.x) + Math.abs(next.y - curr.y);
      const r = Math.min(CORNER_R, segLen1 / 2, segLen2 / 2);
      const bx = curr.x - (dx1 || 0) * r - (0) * r;
      const by = curr.y - (dy1 || 0) * r - (0) * r;
      const ax = curr.x + (dx2 || 0) * r;
      const ay = curr.y + (dy2 || 0) * r;
      parts.push(`L ${bx} ${by}`);
      parts.push(`Q ${curr.x} ${curr.y} ${ax} ${ay}`);
    }
    const last = pts[pts.length - 1];
    parts.push(`L ${last.x} ${last.y}`);
    return parts.join(" ");
  }

  const depArrows = dependencies
    .map((dep) => {
      const srcIdx = scheduled.findIndex((s) => s.id === dep.source_stage_id);
      const tgtIdx = scheduled.findIndex((s) => s.id === dep.target_stage_id);
      if (srcIdx === -1 || tgtIdx === -1) return null;
      const srcBounds = getBarBounds(scheduled[srcIdx]);
      const tgtBounds = getBarBounds(scheduled[tgtIdx]);
      if (!srcBounds || !tgtBounds) return null;

      const srcY = srcIdx * ROW_HEIGHT + BAR_Y_OFFSET + BAR_HEIGHT / 2;
      const tgtY = tgtIdx * ROW_HEIGHT + BAR_Y_OFFSET + BAR_HEIGHT / 2;
      const srcX = srcBounds.x + srcBounds.width;
      const tgtX = tgtBounds.x;

      const goingDown = tgtIdx > srcIdx;
      const minRow = Math.min(srcIdx, tgtIdx);
      const maxRow = Math.max(srcIdx, tgtIdx);

      // Find a safe X for the vertical segment that doesn't cross intermediate bars
      let safeX = srcX + ARROW_MARGIN;

      for (const bar of allBarBounds) {
        if (bar.row > minRow && bar.row < maxRow) {
          // Would the vertical line at safeX cross this bar?
          if (safeX >= bar.x - 4 && safeX <= bar.right + 4) {
            safeX = Math.max(safeX, bar.right + ARROW_MARGIN);
          }
        }
      }

      // Also ensure safeX doesn't overlap the target bar
      if (safeX >= tgtBounds.x - 4 && safeX <= tgtBounds.x + tgtBounds.width + 4 && tgtX < srcX) {
        safeX = Math.max(safeX, tgtBounds.x + tgtBounds.width + ARROW_MARGIN);
      }

      const pts: { x: number; y: number }[] = [];

      if (tgtX >= srcX + ARROW_MARGIN * 2 && Math.abs(srcIdx - tgtIdx) <= 1) {
        // Simple case: target is far enough right and adjacent row — direct L-path
        pts.push({ x: srcX, y: srcY });
        pts.push({ x: safeX, y: srcY });
        pts.push({ x: safeX, y: tgtY });
        pts.push({ x: tgtX, y: tgtY });
      } else if (tgtX >= srcX) {
        // Target is to the right but with intermediate rows — route via safe channel
        pts.push({ x: srcX, y: srcY });
        pts.push({ x: safeX, y: srcY });
        pts.push({ x: safeX, y: tgtY });
        pts.push({ x: tgtX, y: tgtY });
      } else {
        // Backward dependency: target is to the left — S-shape route
        // Go right from source, drop to gutter below/above, go left, then enter target
        const gutterY = goingDown
          ? (srcIdx + 1) * ROW_HEIGHT - 2
          : srcIdx * ROW_HEIGHT + 2;
        const entryGutterY = goingDown
          ? tgtIdx * ROW_HEIGHT + 2
          : (tgtIdx + 1) * ROW_HEIGHT - 2;

        // Find safe X on the left side of target
        let leftSafeX = tgtX - ARROW_MARGIN;
        for (const bar of allBarBounds) {
          if (bar.row > minRow && bar.row < maxRow) {
            if (leftSafeX >= bar.x - 4 && leftSafeX <= bar.right + 4) {
              leftSafeX = Math.min(leftSafeX, bar.x - ARROW_MARGIN);
            }
          }
        }

        pts.push({ x: srcX, y: srcY });
        pts.push({ x: safeX, y: srcY });
        pts.push({ x: safeX, y: gutterY });
        pts.push({ x: leftSafeX, y: gutterY });
        pts.push({ x: leftSafeX, y: entryGutterY });
        pts.push({ x: leftSafeX, y: tgtY });
        pts.push({ x: tgtX, y: tgtY });
      }

      return { id: dep.id, path: buildRoundedPath(pts) };
    })
    .filter(Boolean) as { id: string; path: string }[];

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      {/* Progress bar */}
      {progress !== undefined && !hideProgress && (
        <div className="px-3 py-2 border-b flex items-center gap-2">
          <div className="flex-1 bg-secondary rounded-full h-2 max-w-[200px]">
            <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-muted-foreground font-medium">{progress}%</span>
        </div>
      )}

      <div className="flex">
        {/* Left: stage labels */}
        <div className="shrink-0 border-r" style={{ width: LABEL_WIDTH }}>
          {/* Header spacer */}
          <div className="border-b px-3 flex items-center" style={{ height: HEADER_HEIGHT }}>
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stages</span>
          </div>
          {/* Stage rows */}
          {scheduled.map((stage) => {
            const statusIcon =
              stage.status === "completed" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              ) : stage.status === "in_progress" ? (
                <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin shrink-0" />
              ) : (
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              );

            return (
              <div
                key={stage.id}
                className={`border-b px-3 flex items-center gap-2 hover:bg-muted/30 transition-colors group ${
                  canEdit ? "cursor-pointer" : ""
                }`}
                style={{ height: ROW_HEIGHT }}
                onClick={canEdit ? () => onEditStage!(stage.id) : undefined}
              >
                {statusIcon}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{stage.name}</p>
                  {!hideWorkerName && stage.assigned_to && workerNames?.[stage.assigned_to] && (
                    <p className="text-[10px] text-muted-foreground truncate flex items-center gap-0.5">
                      <User className="h-2.5 w-2.5" />
                      {workerNames[stage.assigned_to]}
                    </p>
                  )}
                </div>
                {canEdit && (
                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                )}
              </div>
            );
          })}
          {/* Add Stage button */}
          {canAdd && (
            <button
              onClick={onAddStage}
              className="w-full border-b px-3 flex items-center gap-2 hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground"
              style={{ height: ROW_HEIGHT }}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="text-sm">Add Stage</span>
            </button>
          )}
        </div>

        {/* Right: timeline */}
        <div className="flex-1 overflow-x-auto" ref={scrollRef}>
          <div style={{ width: chartWidth, minWidth: "100%" }}>
            {/* Month headers */}
            <div className="flex border-b" style={{ height: HEADER_HEIGHT / 2 }}>
              {monthHeaders.map((mh) => (
                <div
                  key={`${mh.label}-${mh.startCol}`}
                  className="text-[10px] font-medium text-muted-foreground flex items-center justify-center border-r"
                  style={{ width: mh.span * colWidth, marginLeft: mh.startCol === 0 ? 0 : undefined }}
                >
                  {mh.label}
                </div>
              ))}
            </div>
            {/* Day headers */}
            <div className="flex border-b" style={{ height: HEADER_HEIGHT / 2 }}>
              {dateColumns.map((col, i) => (
                <div
                  key={i}
                  className={`text-[10px] text-center border-r flex items-center justify-center ${
                    col.isToday
                      ? "bg-primary/10 font-bold text-primary"
                      : "text-muted-foreground"
                  }`}
                  style={{ width: colWidth }}
                >
                  {col.showLabel ? col.label : ""}
                </div>
              ))}
            </div>

            {/* Chart area */}
            <div className="relative" style={{ height: chartHeight }} ref={chartAreaRef}>
              {/* Grid lines */}
              {dateColumns.map((col, i) => (
                <div
                  key={i}
                  className={`absolute top-0 border-r ${
                    col.isToday ? "border-primary/30" : "border-border/40"
                  }`}
                  style={{ left: i * colWidth + colWidth, height: chartHeight, width: 0 }}
                />
              ))}

              {/* Row backgrounds */}
              {scheduled.map((_, i) => (
                <div
                  key={i}
                  className={`absolute w-full border-b ${i % 2 === 0 ? "bg-transparent" : "bg-muted/20"}`}
                  style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
                />
              ))}

              {/* Today marker */}
              {todayOffset !== null && (
                <div
                  className="absolute top-0 w-0.5 bg-primary/60 z-10"
                  style={{ left: todayOffset, height: chartHeight }}
                />
              )}

              {/* SVG layer for dependency arrows + link drag line */}
              <svg className="absolute inset-0 pointer-events-none z-20" style={{ width: chartWidth, height: chartHeight }}>
                <defs>
                  <marker id="gantt-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <path d="M 0 0 L 8 3 L 0 6 Z" className="fill-muted-foreground" />
                  </marker>
                </defs>
                {depArrows.map((arrow) => (
                  <path
                    key={arrow.id}
                    d={arrow.path}
                    fill="none"
                    className="stroke-muted-foreground"
                    strokeWidth={1.5}
                    markerEnd="url(#gantt-arrow)"
                  />
                ))}
                {/* Temporary link-drag line */}
                {linkDrag && (
                  <line
                    x1={linkDrag.sourceX}
                    y1={linkDrag.sourceY}
                    x2={linkDrag.currentX}
                    y2={linkDrag.currentY}
                    stroke={linkHoverTarget ? "rgb(59 130 246)" : "rgb(156 163 175)"}
                    strokeWidth={2}
                    strokeDasharray={linkHoverTarget ? "none" : "6 3"}
                  />
                )}
              </svg>

              {/* Stage bars */}
              {scheduled.map((stage, i) => {
                const bounds = getBarBounds(stage);
                if (!bounds) return null;

                let barX = bounds.x;
                let barWidth = bounds.width;

                // Apply drag offset using ref for smooth tracking
                if (dragState?.stageId === stage.id) {
                  const pxOffset = dragDays.current * colWidth;
                  if (dragState.edge === "start") {
                    barX += pxOffset;
                    barWidth -= pxOffset;
                    if (barWidth < colWidth) {
                      barX = bounds.x + bounds.width - colWidth;
                      barWidth = colWidth;
                    }
                  } else if (dragState.edge === "end") {
                    barWidth += pxOffset;
                    if (barWidth < colWidth) barWidth = colWidth;
                  } else {
                    barX += pxOffset;
                  }
                }

                const color = getStatusColor(stage.status);
                const y = i * ROW_HEIGHT + BAR_Y_OFFSET;
                const isDragging = dragState?.stageId === stage.id;
                const isLinkTarget = linkHoverTarget === stage.id;

                // Actual progress fill for in_progress stages
                let fillPct = 0;
                if (stage.status === "completed") {
                  fillPct = 100;
                } else if (stage.status === "in_progress" && stage.started_at) {
                  const start = parseDate(stage.planned_start) || parseDate(stage.started_at)!;
                  const end = parseDate(stage.estimated_completion);
                  if (end) {
                    const total = differenceInDays(end, start) || 1;
                    const elapsed = differenceInDays(startOfDay(new Date()), start);
                    fillPct = Math.min(Math.max(Math.round((elapsed / total) * 100), 5), 95);
                  }
                }

                return (
                  <div
                    key={stage.id}
                    className={`absolute rounded-md shadow-sm border group/bar ${
                      isDragging ? "ring-2 ring-primary shadow-md z-30" : "z-10"
                    } ${isLinkTarget ? "ring-2 ring-blue-400 shadow-lg z-30" : ""} ${canDrag ? "cursor-grab" : ""}`}
                    style={{
                      left: barX,
                      top: y,
                      width: barWidth,
                      height: BAR_HEIGHT,
                      backgroundColor: color.bg,
                      borderColor: color.bgDark,
                      opacity: isDragging ? 0.85 : 1,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, stage.id, "move")}
                  >
                    {/* Progress fill overlay */}
                    {fillPct > 0 && fillPct < 100 && (
                      <div
                        className="absolute inset-0 rounded-md opacity-30"
                        style={{
                          width: `${fillPct}%`,
                          backgroundColor: "rgba(0,0,0,0.2)",
                        }}
                      />
                    )}

                    {/* Bar label */}
                    <div className="absolute inset-0 flex items-center px-2 overflow-hidden">
                      <span className="text-[11px] font-medium text-white truncate drop-shadow-sm">
                        {stage.name}
                        {!hideEstCompletion && stage.estimated_completion && barWidth > 120 && (
                          <span className="opacity-75 ml-1">
                            {format(parseDate(stage.estimated_completion)!, "MMM d")}
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Drag handles for start and end edges */}
                    {canDrag && (
                      <>
                        <div
                          className="absolute left-0 top-0 w-2 h-full cursor-col-resize hover:bg-white/30 rounded-l-md"
                          onMouseDown={(e) => handleMouseDown(e, stage.id, "start")}
                        />
                        <div
                          className="absolute right-0 top-0 w-2 h-full cursor-col-resize hover:bg-white/30 rounded-r-md"
                          onMouseDown={(e) => handleMouseDown(e, stage.id, "end")}
                        />
                      </>
                    )}

                    {/* Dependency connector handle on right edge */}
                    {canLink && !isDragging && (
                      <div
                        className="absolute opacity-0 group-hover/bar:opacity-100 transition-opacity cursor-crosshair z-40"
                        style={{
                          right: -(CONNECTOR_SIZE / 2),
                          top: (BAR_HEIGHT - CONNECTOR_SIZE) / 2,
                          width: CONNECTOR_SIZE,
                          height: CONNECTOR_SIZE,
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleConnectorMouseDown(e, stage.id, barX + barWidth, y + BAR_HEIGHT / 2);
                        }}
                      >
                        <div className="w-full h-full rounded-full bg-blue-500 border-2 border-white shadow-sm" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Unscheduled stages */}
      {unscheduled.length > 0 && (
        <div className="border-t px-3 py-2">
          <p className="text-xs text-muted-foreground mb-1.5">
            Unscheduled ({unscheduled.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {unscheduled.map((stage) => {
              const statusIcon =
                stage.status === "completed" ? (
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                ) : stage.status === "in_progress" ? (
                  <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
                ) : (
                  <Clock className="h-3 w-3 text-muted-foreground" />
                );

              return (
                <span
                  key={stage.id}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                    canEdit ? "cursor-pointer hover:bg-muted/50" : ""
                  }`}
                  onClick={canEdit ? () => onEditStage!(stage.id) : undefined}
                >
                  {statusIcon}
                  {stage.name}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
