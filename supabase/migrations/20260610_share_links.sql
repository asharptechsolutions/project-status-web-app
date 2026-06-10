-- ============ OTP-GATED CLIENT SHARE LINKS ============
-- Projects can expose a share token. The /share/[token] page resolves the
-- token (server-side, admin client) and asks the visitor to verify a one-time
-- email code. Authorization is still enforced by project_clients + RLS —
-- the token alone grants no data access.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_enabled BOOLEAN NOT NULL DEFAULT false;

-- Token lookups by the share resolver API
CREATE INDEX IF NOT EXISTS idx_projects_share_token
  ON projects(share_token) WHERE share_token IS NOT NULL;
