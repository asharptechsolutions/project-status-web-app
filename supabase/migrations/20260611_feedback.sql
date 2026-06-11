-- ============ CLIENT FEEDBACK ============
-- Post-completion rating + comment from clients. One feedback row per
-- client per project.

CREATE TABLE IF NOT EXISTS project_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_team ON project_feedback(team_id, created_at DESC);

ALTER TABLE project_feedback ENABLE ROW LEVEL SECURITY;

-- Team members read their team's feedback
DROP POLICY IF EXISTS "Team reads feedback" ON project_feedback;
CREATE POLICY "Team reads feedback"
  ON project_feedback FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = project_feedback.team_id AND team_members.user_id = auth.uid())
  );

-- Assigned clients submit + read their own feedback
DROP POLICY IF EXISTS "Clients write own feedback" ON project_feedback;
CREATE POLICY "Clients write own feedback"
  ON project_feedback FOR INSERT
  WITH CHECK (
    client_id = auth.uid()
    AND EXISTS (SELECT 1 FROM project_clients WHERE project_clients.project_id = project_feedback.project_id AND project_clients.client_id = auth.uid())
  );

DROP POLICY IF EXISTS "Clients read own feedback" ON project_feedback;
CREATE POLICY "Clients read own feedback"
  ON project_feedback FOR SELECT
  USING (client_id = auth.uid());
