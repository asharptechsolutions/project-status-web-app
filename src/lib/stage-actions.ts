import { updateProjectStage, startTimer, stopTimer } from "./data";
import { runStageAutomations } from "./automations";
import { trackActivity } from "./activity";
import type { AutomationSettings, Project, ProjectStage, StageDependency, TimeEntry } from "./types";

export interface StageTransitionParams {
  stage: ProjectStage;
  project: Project;
  stages: ProjectStage[];
  dependencies: StageDependency[];
  automationSettings: AutomationSettings | null;
  userId: string;
  actorName: string;
  status: ProjectStage["status"];
  /** Admins can act on any stage; workers only on stages assigned to them or unassigned */
  canActOnAnyStage: boolean;
  /** The caller's currently running timer, if any */
  activeTimer?: TimeEntry | null;
}

export interface StageTransitionResult {
  updatedStages: ProjectStage[];
  projectCompleted: boolean;
  /** Timer that was auto-stopped (caller should update local state + toast) */
  stoppedTimer: TimeEntry | null;
  /** Timer that was auto-started */
  startedTimer: TimeEntry | null;
  /** Completion was intercepted by a client approval gate — stage now awaits sign-off */
  approvalRequested?: boolean;
}

/**
 * Shared orchestration for moving a stage between statuses.
 * Handles permissions, timer auto-start/stop, the DB update,
 * stage automations, and activity logging. Callers own local
 * state updates and toasts.
 */
export async function performStageTransition({
  stage,
  project,
  stages,
  dependencies,
  automationSettings,
  userId,
  actorName,
  status,
  canActOnAnyStage,
  activeTimer = null,
}: StageTransitionParams): Promise<StageTransitionResult> {
  // Workers can only update unassigned stages or stages assigned to them
  if (!canActOnAnyStage && stage.assigned_to && stage.assigned_to !== userId) {
    throw new Error("You can only update stages assigned to you");
  }

  if (stage.on_hold) {
    throw new Error(`This stage is on hold${stage.hold_reason ? ` — ${stage.hold_reason}` : ""}. Clear the hold first.`);
  }

  // Approval gate: completing a gated stage routes through client sign-off instead
  if (status === "completed" && stage.requires_client_approval && stage.approval_status !== "approved") {
    const gateUpdates: Partial<ProjectStage> = { approval_status: "pending" };
    await updateProjectStage(stage.id, gateUpdates);
    trackActivity({
      teamId: project.team_id,
      actorId: userId,
      actorName,
      action: "updated",
      entityType: "stage",
      entityId: stage.id,
      entityName: stage.name,
      projectId: project.id,
      metadata: { approvalRequested: true, project_name: project.name },
    });
    return {
      updatedStages: stages.map((s) => (s.id === stage.id ? { ...s, ...gateUpdates } : s)),
      projectCompleted: false,
      stoppedTimer: null,
      startedTimer: null,
      approvalRequested: true,
    };
  }

  const now = new Date().toISOString();
  const updates: Partial<ProjectStage> = { status };
  if (status === "in_progress") { updates.started_at = now; updates.started_by = userId; }
  if (status === "completed") { updates.completed_at = now; }

  let stoppedTimer: TimeEntry | null = null;
  let startedTimer: TimeEntry | null = null;

  // Auto-stop timer if completing a stage with active timer
  if (status === "completed" && activeTimer && activeTimer.stage_id === stage.id) {
    stoppedTimer = await stopTimer(activeTimer.id);
  }

  // Auto-start timer when starting a stage — attribute to assigned worker if present, otherwise logged-in user
  if (status === "in_progress" && project.time_tracking_enabled && project.time_tracking_auto_start !== false) {
    if (activeTimer && !stoppedTimer) {
      stoppedTimer = await stopTimer(activeTimer.id);
    }
    startedTimer = await startTimer({
      team_id: project.team_id,
      project_id: project.id,
      stage_id: stage.id,
      user_id: stage.assigned_to || userId,
      billable: project.time_tracking_default_billable ?? true,
    });
  }

  await updateProjectStage(stage.id, updates);

  const resolvedStages = stages.map((s) => (s.id === stage.id ? { ...s, ...updates } : s));

  const { updatedStages, projectCompleted } = await runStageAutomations(stage.id, status, {
    settings: automationSettings,
    project,
    stages: resolvedStages,
    dependencies,
    userId,
  });

  trackActivity({
    teamId: project.team_id,
    actorId: userId,
    actorName,
    action: status === "completed" ? "completed" : status === "in_progress" ? "started" : "updated",
    entityType: "stage",
    entityId: stage.id,
    entityName: stage.name,
    projectId: project.id,
    metadata: { newStatus: status, project_name: project.name },
  });

  if (projectCompleted) {
    trackActivity({
      teamId: project.team_id,
      actorId: userId,
      actorName,
      action: "completed",
      entityType: "project",
      entityId: project.id,
      entityName: project.name,
      projectId: project.id,
      metadata: { completedViaAutomation: true, project_name: project.name },
    });
  }

  return { updatedStages, projectCompleted, stoppedTimer, startedTimer };
}
