-- FIX EVERYTHING: rename columns + create clients
-- Safe to run multiple times (all IF EXISTS / IF NOT EXISTS)

-- 1. Rename org_id → team_id everywhere
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='org_id') THEN
    ALTER TABLE public.projects RENAME COLUMN org_id TO team_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='templates' AND column_name='org_id') THEN
    ALTER TABLE public.templates RENAME COLUMN org_id TO team_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='preset_stages' AND column_name='org_id') THEN
    ALTER TABLE public.preset_stages RENAME COLUMN org_id TO team_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='project_assignments' AND column_name='org_id') THEN
    ALTER TABLE public.project_assignments RENAME COLUMN org_id TO team_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='org_id') THEN
    ALTER TABLE public.messages RENAME COLUMN org_id TO team_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='files' AND column_name='org_id') THEN
    ALTER TABLE public.files RENAME COLUMN org_id TO team_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name='org_id') THEN
    ALTER TABLE public.members RENAME COLUMN org_id TO team_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name='clerk_user_id') THEN
    ALTER TABLE public.members RENAME COLUMN clerk_user_id TO user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='platform_admins' AND column_name='clerk_user_id') THEN
    ALTER TABLE public.platform_admins RENAME COLUMN clerk_user_id TO user_id;
  END IF;
END $$;

-- 2. Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 3. Add client_id to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);

-- 4. Drop ALL existing policies (clean slate)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- 5. Enable RLS on all tables
ALTER TABLE IF EXISTS public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.project_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.preset_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clients ENABLE ROW LEVEL SECURITY;

-- 6. TEAMS
CREATE POLICY "teams_select" ON public.teams FOR SELECT USING (
  created_by::text = auth.uid()::text OR
  id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "teams_insert" ON public.teams FOR INSERT WITH CHECK (
  auth.uid()::text = created_by::text
);
CREATE POLICY "teams_update" ON public.teams FOR UPDATE USING (
  created_by::text = auth.uid()::text
);

-- 7. PROFILES
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (id::text = auth.uid()::text);
CREATE POLICY "profiles_select_team" ON public.profiles FOR SELECT USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (id::text = auth.uid()::text);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (id::text = auth.uid()::text);

-- 8. TEAM_MEMBERS
CREATE POLICY "team_members_select" ON public.team_members FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "team_members_insert" ON public.team_members FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);
CREATE POLICY "team_members_update" ON public.team_members FOR UPDATE USING (user_id::text = auth.uid()::text);
CREATE POLICY "team_members_delete" ON public.team_members FOR DELETE USING (user_id::text = auth.uid()::text);

-- 9. PROJECTS
CREATE POLICY "projects_select" ON public.projects FOR SELECT USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "projects_insert" ON public.projects FOR INSERT WITH CHECK (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "projects_update" ON public.projects FOR UPDATE USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "projects_delete" ON public.projects FOR DELETE USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);

-- 10. PROJECT_STAGES
CREATE POLICY "project_stages_select" ON public.project_stages FOR SELECT USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "project_stages_insert" ON public.project_stages FOR INSERT WITH CHECK (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "project_stages_update" ON public.project_stages FOR UPDATE USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "project_stages_delete" ON public.project_stages FOR DELETE USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);

-- 11. PROJECT_ASSIGNMENTS
CREATE POLICY "project_assignments_select" ON public.project_assignments FOR SELECT USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "project_assignments_insert" ON public.project_assignments FOR INSERT WITH CHECK (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "project_assignments_delete" ON public.project_assignments FOR DELETE USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);

-- 12. MESSAGES
CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);

-- 13. FILES
CREATE POLICY "files_select" ON public.files FOR SELECT USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "files_insert" ON public.files FOR INSERT WITH CHECK (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "files_delete" ON public.files FOR DELETE USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);

-- 14. TEMPLATES
CREATE POLICY "templates_select" ON public.templates FOR SELECT USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "templates_insert" ON public.templates FOR INSERT WITH CHECK (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "templates_update" ON public.templates FOR UPDATE USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "templates_delete" ON public.templates FOR DELETE USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);

-- 15. PRESET_STAGES
CREATE POLICY "preset_stages_select" ON public.preset_stages FOR SELECT USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "preset_stages_insert" ON public.preset_stages FOR INSERT WITH CHECK (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "preset_stages_update" ON public.preset_stages FOR UPDATE USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "preset_stages_delete" ON public.preset_stages FOR DELETE USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);

-- 16. CLIENTS
CREATE POLICY "clients_select" ON public.clients FOR SELECT USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "clients_insert" ON public.clients FOR INSERT WITH CHECK (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "clients_update" ON public.clients FOR UPDATE USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "clients_delete" ON public.clients FOR DELETE USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
