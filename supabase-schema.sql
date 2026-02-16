-- ProjectStatus - Supabase Schema (Post Clerk→Supabase Auth migration)
-- All identity columns use native uuid types matching Supabase Auth.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Auth-linked tables (created fresh for Supabase Auth)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  email text,
  role text CHECK (role IN ('owner', 'worker', 'client')) DEFAULT 'owner',
  team_id uuid REFERENCES public.teams(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_members (
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('owner', 'worker', 'client')) DEFAULT 'worker',
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  PRIMARY KEY (team_id, user_id)
);

-- ============================================================
-- Application tables (uuid columns, FK to teams)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  client_name text DEFAULT '',
  client_email text DEFAULT '',
  client_phone text DEFAULT '',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects(team_id);

CREATE TABLE IF NOT EXISTS public.project_stages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  position integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  started_by uuid
);
CREATE INDEX IF NOT EXISTS idx_project_stages_project_id ON project_stages(project_id);

CREATE TABLE IF NOT EXISTS public.project_assignments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  member_id uuid NOT NULL,
  UNIQUE(project_id, member_id)
);

CREATE TABLE IF NOT EXISTS public.project_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, client_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  sender_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_project_id ON messages(project_id);

CREATE TABLE IF NOT EXISTS public.files (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  content_type text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_files_project_id ON files(project_id);

CREATE TABLE IF NOT EXISTS public.templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  stages jsonb NOT NULL DEFAULT '[]',
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_templates_team_id ON templates(team_id);

CREATE TABLE IF NOT EXISTS public.preset_stages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- Enable RLS
-- ============================================================
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies
-- ============================================================

-- Teams
CREATE POLICY "Users can view their teams" ON public.teams
  FOR SELECT USING (id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "Team creators can update" ON public.teams
  FOR UPDATE USING (created_by = auth.uid());
CREATE POLICY "Authenticated users can create teams" ON public.teams
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can view team profiles" ON public.profiles
  FOR SELECT USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Team members
CREATE POLICY "Members can view their team members" ON public.team_members
  FOR SELECT USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "Owners can manage team members" ON public.team_members
  FOR ALL USING (team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid() AND role = 'owner'));
CREATE POLICY "Users can insert themselves" ON public.team_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Projects (team-based)
CREATE POLICY "projects_select" ON public.projects FOR SELECT USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "projects_insert" ON public.projects FOR INSERT WITH CHECK (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "projects_update" ON public.projects FOR UPDATE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "projects_delete" ON public.projects FOR DELETE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));

-- Project stages (via project → team)
CREATE POLICY "project_stages_select" ON public.project_stages FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));
CREATE POLICY "project_stages_insert" ON public.project_stages FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));
CREATE POLICY "project_stages_update" ON public.project_stages FOR UPDATE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));
CREATE POLICY "project_stages_delete" ON public.project_stages FOR DELETE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));

-- Project assignments (via project → team)
CREATE POLICY "project_assignments_select" ON public.project_assignments FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));
CREATE POLICY "project_assignments_insert" ON public.project_assignments FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));
CREATE POLICY "project_assignments_update" ON public.project_assignments FOR UPDATE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));
CREATE POLICY "project_assignments_delete" ON public.project_assignments FOR DELETE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));

-- Messages (via project → team)
CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));
CREATE POLICY "messages_update" ON public.messages FOR UPDATE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));
CREATE POLICY "messages_delete" ON public.messages FOR DELETE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));

-- Files (via project → team)
CREATE POLICY "files_select" ON public.files FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));
CREATE POLICY "files_insert" ON public.files FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));
CREATE POLICY "files_update" ON public.files FOR UPDATE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));
CREATE POLICY "files_delete" ON public.files FOR DELETE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));

-- Templates (team-based)
CREATE POLICY "templates_select" ON public.templates FOR SELECT USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "templates_insert" ON public.templates FOR INSERT WITH CHECK (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "templates_update" ON public.templates FOR UPDATE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "templates_delete" ON public.templates FOR DELETE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));

-- Preset stages (team-based)
CREATE POLICY "preset_stages_select" ON public.preset_stages FOR SELECT USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "preset_stages_insert" ON public.preset_stages FOR INSERT WITH CHECK (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "preset_stages_update" ON public.preset_stages FOR UPDATE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "preset_stages_delete" ON public.preset_stages FOR DELETE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));

-- Clients (team-based)
CREATE POLICY "clients_select" ON public.clients FOR SELECT USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "clients_insert" ON public.clients FOR INSERT WITH CHECK (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "clients_update" ON public.clients FOR UPDATE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));
CREATE POLICY "clients_delete" ON public.clients FOR DELETE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()));

-- Project clients (via project → team)
CREATE POLICY "project_clients_select" ON public.project_clients FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));
CREATE POLICY "project_clients_insert" ON public.project_clients FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));
CREATE POLICY "project_clients_update" ON public.project_clients FOR UPDATE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));
CREATE POLICY "project_clients_delete" ON public.project_clients FOR DELETE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())));

-- ============================================================
-- Grants
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ============================================================
-- Storage
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('files', 'files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "allow_all_files" ON storage.objects FOR ALL USING (bucket_id = 'files') WITH CHECK (bucket_id = 'files');

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
