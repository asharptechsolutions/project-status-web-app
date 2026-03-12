-- Time tracking: entries table + client visibility toggle

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES project_stages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  notes TEXT,
  billable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_time_entries_stage ON time_entries(stage_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_project ON time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_active ON time_entries(user_id) WHERE end_time IS NULL AND start_time IS NOT NULL;

-- RLS
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view time entries for their team" ON time_entries;
CREATE POLICY "Users can view time entries for their team"
  ON time_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = time_entries.team_id
        AND team_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own time entries" ON time_entries;
CREATE POLICY "Users can update their own time entries"
  ON time_entries FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = time_entries.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can delete their own time entries or admins can delete any" ON time_entries;
CREATE POLICY "Users can delete their own time entries or admins can delete any"
  ON time_entries FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = time_entries.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('owner', 'admin')
    )
  );

-- Per-project time tracking settings
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS time_tracking_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS time_tracking_auto_start BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS time_tracking_default_billable BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS time_tracking_require_notes BOOLEAN NOT NULL DEFAULT false;

-- Fix INSERT RLS: allow admins to insert time entries for other users (e.g. auto-start for assigned worker)
DROP POLICY IF EXISTS "Users can insert their own time entries" ON time_entries;
DROP POLICY IF EXISTS "Users can insert time entries" ON time_entries;
CREATE POLICY "Users can insert time entries"
  ON time_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = time_entries.team_id
        AND team_members.user_id = auth.uid()
    )
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM team_members
        WHERE team_members.team_id = time_entries.team_id
          AND team_members.user_id = auth.uid()
          AND team_members.role IN ('owner', 'admin')
      )
    )
  );

-- Add show_time_tracking to client_visibility_settings
ALTER TABLE client_visibility_settings
  ADD COLUMN IF NOT EXISTS show_time_tracking BOOLEAN NOT NULL DEFAULT false;
