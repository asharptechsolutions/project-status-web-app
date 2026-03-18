-- ============ EMAIL DIGEST SETTINGS ============

CREATE TABLE IF NOT EXISTS digest_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  weekly_digest_enabled BOOLEAN NOT NULL DEFAULT true,
  digest_day INTEGER NOT NULL DEFAULT 1,        -- 0=Sun, 1=Mon, ..., 6=Sat
  digest_hour INTEGER NOT NULL DEFAULT 9,        -- Hour in UTC (0-23)
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id)
);

-- ============ RLS ============

ALTER TABLE digest_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members can view digest settings" ON digest_settings;
CREATE POLICY "Team members can view digest settings"
  ON digest_settings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = digest_settings.team_id
        AND team_members.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owners can manage digest settings" ON digest_settings;
CREATE POLICY "Owners can manage digest settings"
  ON digest_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = digest_settings.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = digest_settings.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('owner', 'admin')
    )
  );
