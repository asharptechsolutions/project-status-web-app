"use client";
import { useEffect, useState } from "react";
import { getTeamCompletedStages } from "./data";
import { learnDurations, type DurationModel } from "./eta";

/**
 * Loads the team's completed-stage history once and builds the predictive
 * duration model. Returns null until loaded (callers can fall back to manual
 * estimates in the meantime).
 */
export function useEtaModel(orgId: string | null | undefined): DurationModel | null {
  const [model, setModel] = useState<DurationModel | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!orgId) { setModel(null); return; }
    getTeamCompletedStages(orgId)
      .then((stages) => { if (!cancelled) setModel(learnDurations(stages)); })
      .catch(() => { if (!cancelled) setModel(learnDurations([])); });
    return () => { cancelled = true; };
  }, [orgId]);

  return model;
}
