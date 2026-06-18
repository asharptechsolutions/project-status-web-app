-- ============================================================================
-- Catch-up migration: re-applies schema that earlier migrations introduced but
-- that never landed in the live database (manual migration drift). Fully
-- idempotent — safe to run even where parts already exist.
--
-- Found by auditing the live schema against supabase/migrations:
--   * email_templates.layout            (from 20260312_email_layout_accent.sql)
--   * webhooks / webhook_deliveries /
--     slack_integrations tables          (from 20260316_webhooks_slack.sql)
--   * file_read_status table             (from 20260617_file_read_status.sql)
-- ============================================================================

-- 1) Email template layout (Branding & Emails → email templates)
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS layout text NOT NULL DEFAULT 'classic';

-- 2) Webhooks + Slack integration (Settings → Integrations)
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  secret TEXT,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INTEGER,
  response_body TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  attempt INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_created
  ON webhook_deliveries(webhook_id, created_at DESC);

CREATE TABLE IF NOT EXISTS slack_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  channel_name TEXT,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id)
);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members can view webhooks" ON webhooks;
CREATE POLICY "Team members can view webhooks" ON webhooks FOR SELECT
  USING (EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = webhooks.team_id AND team_members.user_id = auth.uid()));
DROP POLICY IF EXISTS "Owners can manage webhooks" ON webhooks;
CREATE POLICY "Owners can manage webhooks" ON webhooks FOR ALL
  USING (EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = webhooks.team_id AND team_members.user_id = auth.uid() AND team_members.role IN ('owner','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = webhooks.team_id AND team_members.user_id = auth.uid() AND team_members.role IN ('owner','admin')));

DROP POLICY IF EXISTS "Team members can view webhook deliveries" ON webhook_deliveries;
CREATE POLICY "Team members can view webhook deliveries" ON webhook_deliveries FOR SELECT
  USING (EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = webhook_deliveries.team_id AND team_members.user_id = auth.uid()));
DROP POLICY IF EXISTS "Service role can insert webhook deliveries" ON webhook_deliveries;
CREATE POLICY "Service role can insert webhook deliveries" ON webhook_deliveries FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Team members can view slack integrations" ON slack_integrations;
CREATE POLICY "Team members can view slack integrations" ON slack_integrations FOR SELECT
  USING (EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = slack_integrations.team_id AND team_members.user_id = auth.uid()));
DROP POLICY IF EXISTS "Owners can manage slack integrations" ON slack_integrations;
CREATE POLICY "Owners can manage slack integrations" ON slack_integrations FOR ALL
  USING (EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = slack_integrations.team_id AND team_members.user_id = auth.uid() AND team_members.role IN ('owner','admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM team_members WHERE team_members.team_id = slack_integrations.team_id AND team_members.user_id = auth.uid() AND team_members.role IN ('owner','admin')));

-- 3) File read status (dashboard "new file" indicator)
CREATE TABLE IF NOT EXISTS file_read_status (
  user_id TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);
ALTER TABLE file_read_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "allow_all" ON file_read_status;
CREATE POLICY "allow_all" ON file_read_status FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON file_read_status TO anon, authenticated;
