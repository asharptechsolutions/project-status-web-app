import type { ProjectStage, StageDependency } from "./types";

// Predictive ETA engine. Learns how long each named stage actually takes
// from a shop's own completed-stage history, then rolls those durations
// through the dependency graph to forecast a project's ship date with a
// confidence band. No external service — pure arithmetic over existing data.

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_STAGE_MS = 2 * DAY_MS; // fallback when we have no history at all
const MIN_SAMPLES = 2; // below this, a stage name's own history isn't trusted

export interface StageDurationStats {
  samples: number;
  p25: number;
  p50: number;
  p75: number;
}

export interface DurationModel {
  byName: Map<string, StageDurationStats>;
  globalP25: number;
  globalP50: number;
  globalP75: number;
  totalSamples: number;
}

function normName(name: string): string {
  return name.trim().toLowerCase();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Build a duration model from completed stages (started_at → completed_at). */
export function learnDurations(completed: ProjectStage[]): DurationModel {
  const buckets = new Map<string, number[]>();
  const all: number[] = [];
  for (const s of completed) {
    if (!s.started_at || !s.completed_at) continue;
    const ms = new Date(s.completed_at).getTime() - new Date(s.started_at).getTime();
    if (ms <= 0 || ms > 365 * DAY_MS) continue; // ignore bad/implausible rows
    const key = normName(s.name);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(ms);
    all.push(ms);
  }

  const byName = new Map<string, StageDurationStats>();
  for (const [key, arr] of buckets) {
    arr.sort((a, b) => a - b);
    byName.set(key, {
      samples: arr.length,
      p25: percentile(arr, 0.25),
      p50: percentile(arr, 0.5),
      p75: percentile(arr, 0.75),
    });
  }

  all.sort((a, b) => a - b);
  return {
    byName,
    globalP25: all.length ? percentile(all, 0.25) : DEFAULT_STAGE_MS,
    globalP50: all.length ? percentile(all, 0.5) : DEFAULT_STAGE_MS,
    globalP75: all.length ? percentile(all, 0.75) : DEFAULT_STAGE_MS * 1.5,
    totalSamples: all.length,
  };
}

type Band = "p25" | "p50" | "p75";

// Predicted *remaining* time for a stage at a given percentile, accounting
// for time already elapsed on an in-progress stage.
function remainingMs(stage: ProjectStage, model: DurationModel, band: Band, now: number): { ms: number; known: boolean } {
  const stats = model.byName.get(normName(stage.name));
  const known = !!stats && stats.samples >= MIN_SAMPLES;
  const full = known ? stats![band] : model[`global${band[0].toUpperCase()}${band.slice(1)}` as "globalP25" | "globalP50" | "globalP75"];
  if (stage.status === "completed") return { ms: 0, known };
  if (stage.status === "in_progress" && stage.started_at) {
    const elapsed = now - new Date(stage.started_at).getTime();
    return { ms: Math.max(0.1 * full, full - elapsed), known };
  }
  return { ms: full, known };
}

export interface EtaResult {
  /** Point-estimate ship date (p50) */
  predicted: Date;
  /** Optimistic / pessimistic band (p25 / p75) */
  low: Date;
  high: Date;
  /** How much of the remaining work is backed by real history (0–1) */
  coverage: number;
  confidence: "high" | "medium" | "low";
  /** True once every stage is complete */
  done: boolean;
  /** Days the prediction is ahead(+)/behind(−) the manual estimated_completion, if set */
  slipDays: number | null;
}

// Longest path (critical path) of remaining work through the dependency
// DAG, at one percentile band. Falls back to sequential-by-position when
// the project has no dependencies drawn.
function criticalPathMs(
  stages: ProjectStage[],
  dependencies: StageDependency[],
  model: DurationModel,
  band: Band,
  now: number
): { ms: number; knownMs: number; totalMs: number } {
  const incomplete = stages.filter((s) => s.status !== "completed");
  if (incomplete.length === 0) return { ms: 0, knownMs: 0, totalMs: 0 };

  const stageMap = new Map(stages.map((s) => [s.id, s]));
  const preds = new Map<string, string[]>();
  stages.forEach((s) => preds.set(s.id, []));
  const hasDeps = dependencies.length > 0;
  for (const d of dependencies) {
    if (stageMap.has(d.source_stage_id) && stageMap.has(d.target_stage_id)) {
      preds.get(d.target_stage_id)!.push(d.source_stage_id);
    }
  }
  if (!hasDeps) {
    // No graph: chain incomplete stages sequentially by position
    const ordered = [...incomplete].sort((a, b) => a.position - b.position);
    for (let i = 1; i < ordered.length; i++) {
      preds.get(ordered[i].id)!.push(ordered[i - 1].id);
    }
  }

  let knownMs = 0;
  let totalMs = 0;
  const finishMemo = new Map<string, number>();
  const visiting = new Set<string>();

  const finishOf = (id: string): number => {
    if (finishMemo.has(id)) return finishMemo.get(id)!;
    if (visiting.has(id)) return 0; // cycle guard
    visiting.add(id);
    const stage = stageMap.get(id)!;
    const r = remainingMs(stage, model, band, now);
    if (stage.status !== "completed" && band === "p50") {
      totalMs += r.ms;
      if (r.known) knownMs += r.ms;
    }
    let start = 0;
    for (const p of preds.get(id) || []) {
      const pf = stageMap.get(p)!.status === "completed" ? 0 : finishOf(p);
      start = Math.max(start, pf);
    }
    const finish = start + r.ms;
    visiting.delete(id);
    finishMemo.set(id, finish);
    return finish;
  };

  let maxFinish = 0;
  for (const s of incomplete) maxFinish = Math.max(maxFinish, finishOf(s.id));
  return { ms: maxFinish, knownMs, totalMs };
}

/** Forecast a project's ship date from learned stage durations. */
export function predictProjectEta(
  stages: ProjectStage[],
  dependencies: StageDependency[],
  model: DurationModel
): EtaResult {
  const now = Date.now();
  const incomplete = stages.filter((s) => s.status !== "completed");

  if (stages.length === 0 || incomplete.length === 0) {
    const last = stages
      .map((s) => s.completed_at)
      .filter(Boolean)
      .sort()
      .pop();
    return {
      predicted: last ? new Date(last) : new Date(now),
      low: last ? new Date(last) : new Date(now),
      high: last ? new Date(last) : new Date(now),
      coverage: 1,
      confidence: "high",
      done: true,
      slipDays: null,
    };
  }

  const p50 = criticalPathMs(stages, dependencies, model, "p50", now);
  const p25 = criticalPathMs(stages, dependencies, model, "p25", now);
  const p75 = criticalPathMs(stages, dependencies, model, "p75", now);

  const coverage = p50.totalMs > 0 ? p50.knownMs / p50.totalMs : 0;
  const confidence: EtaResult["confidence"] =
    model.totalSamples >= 8 && coverage >= 0.6 ? "high" : coverage >= 0.3 || model.totalSamples >= 4 ? "medium" : "low";

  const predicted = new Date(now + p50.ms);

  // Compare against the latest manual estimate among incomplete stages
  const manualEstimates = incomplete
    .map((s) => s.estimated_completion)
    .filter((d): d is string => !!d)
    .map((d) => new Date(d + "T23:59:59").getTime());
  const manualEnd = manualEstimates.length ? Math.max(...manualEstimates) : null;
  const slipDays = manualEnd !== null ? Math.round((manualEnd - predicted.getTime()) / DAY_MS) : null;

  return {
    predicted,
    low: new Date(now + p25.ms),
    high: new Date(now + p75.ms),
    coverage,
    confidence,
    done: false,
    slipDays,
  };
}

/** Human-friendly band label, e.g. "Jun 18 – 20" or "Jun 18". */
export function formatEtaBand(eta: EtaResult): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const lo = eta.low.toLocaleDateString(undefined, opts);
  const hi = eta.high.toLocaleDateString(undefined, opts);
  return lo === hi ? lo : `${lo} – ${hi}`;
}
