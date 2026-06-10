-- ============ END-TO-END ENCRYPTED MESSAGING ============
-- True E2EE for project chat + attachments. The server only ever stores
-- ciphertext and wrapped keys. Each browser/device holds a non-extractable
-- ECDH P-256 keypair (private key in IndexedDB); the per-project AES-GCM-256
-- key is wrapped per device via ECDH and stored in project_key_grants.
-- If every device holding a project key is lost, history is unrecoverable
-- by design.

-- Per-device public keys
CREATE TABLE IF NOT EXISTS user_device_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  public_key JSONB NOT NULL,
  device_label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_id)
);

-- Project key wrapped for one device
CREATE TABLE IF NOT EXISTS project_key_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  wrapped_key TEXT NOT NULL,
  ephemeral_public_key JSONB NOT NULL,
  granted_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_project_key_grants_project ON project_key_grants(project_id);
CREATE INDEX IF NOT EXISTS idx_project_key_grants_user ON project_key_grants(user_id, device_id);

-- Ciphertext metadata on existing chat tables (ciphertext reuses content/file_url)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS iv TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS encrypted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE files ADD COLUMN IF NOT EXISTS iv TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS encrypted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE files ADD COLUMN IF NOT EXISTS encrypted_metadata TEXT;

-- Per-project switch (one-way: enabling is a key-generation event)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS encryption_enabled BOOLEAN NOT NULL DEFAULT false;

-- ============ RLS ============

ALTER TABLE user_device_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_key_grants ENABLE ROW LEVEL SECURITY;

-- Users manage their own device keys
DROP POLICY IF EXISTS "Users can insert own device keys" ON user_device_keys;
CREATE POLICY "Users can insert own device keys"
  ON user_device_keys FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own device keys" ON user_device_keys;
CREATE POLICY "Users can delete own device keys"
  ON user_device_keys FOR DELETE
  USING (user_id = auth.uid());

-- Users can see their own keys plus keys of anyone sharing a team
-- (needed to wrap project keys for teammates' and clients' devices)
DROP POLICY IF EXISTS "Users can view team device keys" ON user_device_keys;
CREATE POLICY "Users can view team device keys"
  ON user_device_keys FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM team_members mine
      JOIN team_members theirs ON theirs.team_id = mine.team_id
      WHERE mine.user_id = auth.uid()
        AND theirs.user_id = user_device_keys.user_id
    )
  );

-- Grant rows: readable by the grantee and by members of the project's team
-- (key holders need to see which devices already have grants)
DROP POLICY IF EXISTS "Users can view key grants" ON project_key_grants;
CREATE POLICY "Users can view key grants"
  ON project_key_grants FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM projects p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE p.id = project_key_grants.project_id
        AND tm.user_id = auth.uid()
    )
  );

-- Any member of the project's team may insert grants. Holding the project
-- key is the real gate — without it a member cannot produce a valid grant.
DROP POLICY IF EXISTS "Team members can create key grants" ON project_key_grants;
CREATE POLICY "Team members can create key grants"
  ON project_key_grants FOR INSERT
  WITH CHECK (
    granted_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM projects p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE p.id = project_key_grants.project_id
        AND tm.user_id = auth.uid()
    )
  );
