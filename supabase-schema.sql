-- ProjectStatus - Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Platform admins table
CREATE TABLE IF NOT EXISTS platform_admins (
  clerk_user_id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organizations (synced from Clerk)
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Members
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_user_id TEXT NOT NULL,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'worker', 'client')),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clerk_user_id, org_id)
);
CREATE INDEX IF NOT EXISTS idx_members_org_id ON members(org_id);
CREATE INDEX IF NOT EXISTS idx_members_clerk_user_id ON members(clerk_user_id);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- projects.company_id (nullable FK to companies)
-- ALTER TABLE projects ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON projects(org_id);

-- Project stages
CREATE TABLE IF NOT EXISTS project_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  position INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  started_by TEXT,
  assigned_to TEXT
);
CREATE INDEX IF NOT EXISTS idx_project_stages_project_id ON project_stages(project_id);

-- Companies (team-scoped)
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_companies_team_id ON companies(team_id);

-- team_members.company_id (nullable FK to companies)
-- ALTER TABLE team_members ADD COLUMN company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- Project assignments (client access)
CREATE TABLE IF NOT EXISTS project_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  UNIQUE(project_id, member_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  file_id UUID REFERENCES files(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_project_id ON messages(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_file_id ON messages(file_id);

-- Files
CREATE TABLE IF NOT EXISTS files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  content_type TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);

-- Templates (org-level)
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  stages JSONB NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_templates_org_id ON templates(org_id);

-- Preset stages (org-level)
CREATE TABLE IF NOT EXISTS preset_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project notes (internal, timestamped log replacing single description field)
CREATE TABLE IF NOT EXISTS project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_project_notes_project_id ON project_notes(project_id);

-- Message read status (per-user, per-project last-read timestamp)
CREATE TABLE IF NOT EXISTS message_read_status (
  user_id TEXT NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, project_id)
);

-- Enable RLS on all tables
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE preset_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_status ENABLE ROW LEVEL SECURITY;

-- Permissive policies (service role bypasses RLS; anon gets broad access for now)
-- These will be refined with proper Clerk JWT integration later
CREATE POLICY "allow_all" ON organizations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON project_stages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON project_assignments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON preset_stages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON project_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON platform_admins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON message_read_status FOR ALL USING (true) WITH CHECK (true);

-- Grant access
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Create storage bucket for files
INSERT INTO storage.buckets (id, name, public) VALUES ('files', 'files', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to files bucket
CREATE POLICY "allow_all_files" ON storage.objects FOR ALL USING (bucket_id = 'files') WITH CHECK (bucket_id = 'files');
