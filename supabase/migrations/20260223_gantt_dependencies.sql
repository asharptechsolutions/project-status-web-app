-- Add planned_start to project_stages
ALTER TABLE project_stages ADD COLUMN IF NOT EXISTS planned_start DATE;

-- Stage dependencies table
CREATE TABLE IF NOT EXISTS stage_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_stage_id UUID NOT NULL REFERENCES project_stages(id) ON DELETE CASCADE,
  target_stage_id UUID NOT NULL REFERENCES project_stages(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'finish_to_start'
    CHECK (dependency_type IN ('finish_to_start')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_stage_id, target_stage_id)
);

ALTER TABLE stage_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stage_dependencies_all" ON stage_dependencies
  FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_stage_deps_project ON stage_dependencies(project_id);
