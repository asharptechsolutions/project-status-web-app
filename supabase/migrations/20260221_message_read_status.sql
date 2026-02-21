-- Track when each user last read messages in a project
CREATE TABLE IF NOT EXISTS message_read_status (
  user_id TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

ALTER TABLE message_read_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON message_read_status FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON message_read_status TO anon, authenticated;
