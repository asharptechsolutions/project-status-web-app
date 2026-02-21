-- Add project_notes table for timestamped internal notes on projects
-- Replaces the single description field with a log of notes

CREATE TABLE IF NOT EXISTS project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_notes_project_id ON project_notes(project_id);

-- Enable RLS
ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;

-- Permissive policy (matches existing pattern)
CREATE POLICY "allow_all" ON project_notes FOR ALL USING (true) WITH CHECK (true);

-- Grant access
GRANT ALL ON project_notes TO anon, authenticated;

-- Migrate existing non-empty descriptions into notes
INSERT INTO project_notes (project_id, author_id, author_name, content, created_at)
SELECT id, 'system', 'System (migrated)', description, created_at
FROM projects
WHERE description IS NOT NULL AND description != '';
