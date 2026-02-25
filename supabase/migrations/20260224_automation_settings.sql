CREATE TABLE IF NOT EXISTS automation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  auto_start_next_stage BOOLEAN NOT NULL DEFAULT false,
  auto_complete_project BOOLEAN NOT NULL DEFAULT true,
  notify_client_stage_complete BOOLEAN NOT NULL DEFAULT true,
  notify_worker_on_assign BOOLEAN NOT NULL DEFAULT false,
  auto_advance_blocked_stages BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id)
);

ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view automation settings"
  ON automation_settings FOR SELECT
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "Team owners can manage automation settings"
  ON automation_settings FOR ALL
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'owner'));
