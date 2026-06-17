-- Track when each user last viewed a project's files, so the dashboard can flag
-- newly received files (mirrors message_read_status for chat).
CREATE TABLE IF NOT EXISTS file_read_status (
  user_id TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

ALTER TABLE file_read_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON file_read_status FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON file_read_status TO anon, authenticated;
