CREATE TABLE IF NOT EXISTS client_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  client_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  notify_stage_complete BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, project_id)
);

ALTER TABLE client_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Clients can view/manage their own notification preferences
CREATE POLICY "Clients can view own notification preferences"
  ON client_notification_preferences FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Clients can insert own notification preferences"
  ON client_notification_preferences FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Clients can update own notification preferences"
  ON client_notification_preferences FOR UPDATE
  USING (client_id = auth.uid());

-- Team owners can view all preferences (for the notify API via service role, but good to have)
CREATE POLICY "Team owners can view notification preferences"
  ON client_notification_preferences FOR SELECT
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role = 'owner'));
