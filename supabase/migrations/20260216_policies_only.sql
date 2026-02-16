-- POLICIES ONLY - uses ::text casts to handle any type mismatch
-- Run the DROP block first, then this

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

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

-- TEAMS
CREATE POLICY "teams_select" ON public.teams FOR SELECT USING (
  created_by::text = auth.uid()::text OR id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "teams_insert" ON public.teams FOR INSERT WITH CHECK (created_by::text = auth.uid()::text);
CREATE POLICY "teams_update" ON public.teams FOR UPDATE USING (created_by::text = auth.uid()::text);

-- PROFILES
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (id::text = auth.uid()::text);
CREATE POLICY "profiles_select_team" ON public.profiles FOR SELECT USING (
  id::text IN (SELECT user_id::text FROM public.team_members WHERE team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (id::text = auth.uid()::text);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (id::text = auth.uid()::text);

-- TEAM_MEMBERS
CREATE POLICY "tm_select" ON public.team_members FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "tm_select_team" ON public.team_members FOR SELECT USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "tm_insert" ON public.team_members FOR INSERT WITH CHECK (user_id::text = auth.uid()::text);
CREATE POLICY "tm_delete" ON public.team_members FOR DELETE USING (user_id::text = auth.uid()::text);

-- PROJECTS
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

-- PROJECT_STAGES
CREATE POLICY "ps_select" ON public.project_stages FOR SELECT USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "ps_insert" ON public.project_stages FOR INSERT WITH CHECK (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "ps_update" ON public.project_stages FOR UPDATE USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "ps_delete" ON public.project_stages FOR DELETE USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);

-- PROJECT_ASSIGNMENTS
CREATE POLICY "pa_select" ON public.project_assignments FOR SELECT USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "pa_insert" ON public.project_assignments FOR INSERT WITH CHECK (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "pa_delete" ON public.project_assignments FOR DELETE USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);

-- MESSAGES
CREATE POLICY "msg_select" ON public.messages FOR SELECT USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "msg_insert" ON public.messages FOR INSERT WITH CHECK (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);

-- FILES
CREATE POLICY "files_select" ON public.files FOR SELECT USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "files_insert" ON public.files FOR INSERT WITH CHECK (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);
CREATE POLICY "files_delete" ON public.files FOR DELETE USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text))
);

-- TEMPLATES
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

-- PRESET_STAGES
CREATE POLICY "prs_select" ON public.preset_stages FOR SELECT USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "prs_insert" ON public.preset_stages FOR INSERT WITH CHECK (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "prs_update" ON public.preset_stages FOR UPDATE USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "prs_delete" ON public.preset_stages FOR DELETE USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);

-- CLIENTS
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

NOTIFY pgrst, 'reload schema';
