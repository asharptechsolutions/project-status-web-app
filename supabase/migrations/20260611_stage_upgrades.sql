-- ============ STAGE SYSTEM UPGRADES ============
-- 1. Progress photos: files can attach to a specific stage (captured from
--    the QR action page on the shop floor; shown on the client tracker).
-- 2. Client approval gates: a stage can require the client to sign off
--    before it can complete.
-- 3. Hold state: a stage can be flagged "on hold" (e.g. waiting on
--    materials) without disturbing its pending/in_progress status.
-- 4. Rush priority on projects.

-- Progress photos
ALTER TABLE files ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES project_stages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_files_stage ON files(stage_id) WHERE stage_id IS NOT NULL;

-- Client approval gates
ALTER TABLE project_stages ADD COLUMN IF NOT EXISTS requires_client_approval BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE project_stages ADD COLUMN IF NOT EXISTS approval_status TEXT
  CHECK (approval_status IN ('pending', 'approved', 'changes_requested'));
ALTER TABLE project_stages ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE project_stages ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE project_stages ADD COLUMN IF NOT EXISTS approval_note TEXT;

-- Hold state (waiting on materials, customer info, etc.)
ALTER TABLE project_stages ADD COLUMN IF NOT EXISTS on_hold BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE project_stages ADD COLUMN IF NOT EXISTS hold_reason TEXT;

-- Rush priority
ALTER TABLE projects ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'
  CHECK (priority IN ('normal', 'rush'));
