-- ============ WEBHOOKS & SLACK INTEGRATION ============

-- Webhook endpoint configs per team
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

-- Webhook delivery log
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

-- Index for querying deliveries by webhook, newest first
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_created
  ON webhook_deliveries(webhook_id, created_at DESC);

-- Slack integration (one per org)
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

-- ============ RLS ============

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE slack_integrations ENABLE ROW LEVEL SECURITY;

-- webhooks: SELECT for all team members
DROP POLICY IF EXISTS "Team members can view webhooks" ON webhooks;
CREATE POLICY "Team members can view webhooks"
  ON webhooks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = webhooks.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- webhooks: INSERT/UPDATE/DELETE for owners only
DROP POLICY IF EXISTS "Owners can manage webhooks" ON webhooks;
CREATE POLICY "Owners can manage webhooks"
  ON webhooks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = webhooks.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = webhooks.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('owner', 'admin')
    )
  );

-- webhook_deliveries: SELECT for team members
DROP POLICY IF EXISTS "Team members can view webhook deliveries" ON webhook_deliveries;
CREATE POLICY "Team members can view webhook deliveries"
  ON webhook_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = webhook_deliveries.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- webhook_deliveries: INSERT for service role (delivered by backend)
DROP POLICY IF EXISTS "Service role can insert webhook deliveries" ON webhook_deliveries;
CREATE POLICY "Service role can insert webhook deliveries"
  ON webhook_deliveries FOR INSERT
  WITH CHECK (true);

-- slack_integrations: SELECT for all team members
DROP POLICY IF EXISTS "Team members can view slack integrations" ON slack_integrations;
CREATE POLICY "Team members can view slack integrations"
  ON slack_integrations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = slack_integrations.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- slack_integrations: INSERT/UPDATE/DELETE for owners only
DROP POLICY IF EXISTS "Owners can manage slack integrations" ON slack_integrations;
CREATE POLICY "Owners can manage slack integrations"
  ON slack_integrations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = slack_integrations.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = slack_integrations.team_id
        AND team_members.user_id = auth.uid()
        AND team_members.role IN ('owner', 'admin')
    )
  );
