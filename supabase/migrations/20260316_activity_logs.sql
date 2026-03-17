-- ============ ACTIVITY LOG / AUDIT TRAIL ============

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL,
  actor_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT NOT NULL DEFAULT '',
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Primary query: org activity feed, newest first
CREATE INDEX IF NOT EXISTS idx_activity_logs_team_created
  ON activity_logs(team_id, created_at DESC);

-- Per-project activity tab
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_created
  ON activity_logs(project_id, created_at DESC) WHERE project_id IS NOT NULL;

-- Filter by entity type within an org
CREATE INDEX IF NOT EXISTS idx_activity_logs_team_entity_type
  ON activity_logs(team_id, entity_type, created_at DESC);

-- Filter by actor within an org
CREATE INDEX IF NOT EXISTS idx_activity_logs_team_actor
  ON activity_logs(team_id, actor_id, created_at DESC);

-- ============ RLS ============

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- All team members can read activity logs
DROP POLICY IF EXISTS "Team members can view activity logs" ON activity_logs;
CREATE POLICY "Team members can view activity logs"
  ON activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = activity_logs.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- Team members can insert activity logs for their org
DROP POLICY IF EXISTS "Team members can insert activity logs" ON activity_logs;
CREATE POLICY "Team members can insert activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = activity_logs.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- No UPDATE or DELETE policies: logs are immutable
