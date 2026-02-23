-- ============ CLIENT VISIBILITY SETTINGS ============

CREATE TABLE IF NOT EXISTS client_visibility_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  show_worker_names BOOLEAN NOT NULL DEFAULT true,
  show_estimated_completion BOOLEAN NOT NULL DEFAULT true,
  show_progress_percentage BOOLEAN NOT NULL DEFAULT true,
  show_stage_status BOOLEAN NOT NULL DEFAULT true,
  allow_file_access BOOLEAN NOT NULL DEFAULT true,
  allow_chat BOOLEAN NOT NULL DEFAULT true,
  allow_booking BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id)
);

ALTER TABLE client_visibility_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_visibility_settings_all" ON client_visibility_settings
  FOR ALL USING (true) WITH CHECK (true);
