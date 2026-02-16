-- FINAL FIX - based on actual DB schema
-- Rename clients.org_id → team_id, then set up all RLS

-- 1. Rename org_id on clients table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clients' AND column_name='org_id') THEN
    ALTER TABLE public.clients RENAME COLUMN org_id TO team_id;
  END IF;
END $$;

-- 2. Add client_id to projects if not exists
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);

-- 3. Drop ALL existing policies
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

-- 4. Enable RLS on all tables
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

-- 5. TEAMS
CREATE POLICY "teams_select" ON public.teams FOR SELECT USING (
  created_by::text = auth.uid()::text OR
  id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "teams_insert" ON public.teams FOR INSERT WITH CHECK (auth.uid()::text = created_by::text);
CREATE POLICY "teams_update" ON public.teams FOR UPDATE USING (created_by::text = auth.uid()::text);

-- 6. PROFILES
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (id::text = auth.uid()::text);
CREATE POLICY "profiles_select_team" ON public.profiles FOR SELECT USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (id::text = auth.uid()::text);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (id::text = auth.uid()::text);

-- 7. TEAM_MEMBERS
CREATE POLICY "tm_select" ON public.team_members FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "tm_insert" ON public.team_members FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);
CREATE POLICY "tm_update" ON public.team_members FOR UPDATE USING (user_id::text = auth.uid()::text);
CREATE POLICY "tm_delete" ON public.team_members FOR DELETE USING (user_id::text = auth.uid()::text);

-- 8. PROJECTS (has team_id column)
CREATE POLICY "proj_select" ON public.projects FOR SELECT USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "proj_insert" ON public.projects FOR INSERT WITH CHECK (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "proj_update" ON public.projects FOR UPDATE USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "proj_delete" ON public.projects FOR DELETE USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);

-- 9. PROJECT_STAGES (has project_id, no team_id)
CREATE POLICY "ps_select" ON public.project_stages FOR SELECT USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "ps_insert" ON public.project_stages FOR INSERT WITH CHECK (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "ps_update" ON public.project_stages FOR UPDATE USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "ps_delete" ON public.project_stages FOR DELETE USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);

-- 10. PROJECT_ASSIGNMENTS (has project_id + member_id, no team_id)
CREATE POLICY "pa_select" ON public.project_assignments FOR SELECT USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "pa_insert" ON public.project_assignments FOR INSERT WITH CHECK (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "pa_delete" ON public.project_assignments FOR DELETE USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);

-- 11. MESSAGES (has project_id, no team_id)
CREATE POLICY "msg_select" ON public.messages FOR SELECT USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "msg_insert" ON public.messages FOR INSERT WITH CHECK (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);

-- 12. FILES (has project_id, no team_id)
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

-- 13. TEMPLATES (has team_id)
CREATE POLICY "tpl_select" ON public.templates FOR SELECT USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "tpl_insert" ON public.templates FOR INSERT WITH CHECK (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "tpl_update" ON public.templates FOR UPDATE USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "tpl_delete" ON public.templates FOR DELETE USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);

-- 14. PRESET_STAGES (has team_id)
CREATE POLICY "pst_select" ON public.preset_stages FOR SELECT USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "pst_insert" ON public.preset_stages FOR INSERT WITH CHECK (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "pst_update" ON public.preset_stages FOR UPDATE USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "pst_delete" ON public.preset_stages FOR DELETE USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);

-- 15. CLIENTS (has team_id after rename above)
CREATE POLICY "cl_select" ON public.clients FOR SELECT USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "cl_insert" ON public.clients FOR INSERT WITH CHECK (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "cl_update" ON public.clients FOR UPDATE USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "cl_delete" ON public.clients FOR DELETE USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
