-- COMPREHENSIVE RLS FIX v3
-- Uses text casts to handle type mismatches

------------------------------------------------------------
-- 1. DROP ALL EXISTING POLICIES
------------------------------------------------------------
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

------------------------------------------------------------
-- 2. ENABLE RLS
------------------------------------------------------------
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

------------------------------------------------------------
-- 3. TEAMS
------------------------------------------------------------
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

------------------------------------------------------------
-- 4. PROFILES
------------------------------------------------------------
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (
  id::text = auth.uid()::text
);
CREATE POLICY "profiles_select_team" ON public.profiles FOR SELECT USING (
  team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (
  id::text = auth.uid()::text
);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (
  id::text = auth.uid()::text
);

------------------------------------------------------------
-- 5. TEAM_MEMBERS
------------------------------------------------------------
CREATE POLICY "team_members_select" ON public.team_members FOR SELECT USING (
  user_id::text = auth.uid()::text
);
CREATE POLICY "team_members_insert" ON public.team_members FOR INSERT WITH CHECK (
  user_id::text = auth.uid()::text
);
CREATE POLICY "team_members_update" ON public.team_members FOR UPDATE USING (
  user_id::text = auth.uid()::text
);
CREATE POLICY "team_members_delete" ON public.team_members FOR DELETE USING (
  user_id::text = auth.uid()::text
);

------------------------------------------------------------
-- 6. PROJECTS
------------------------------------------------------------
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

------------------------------------------------------------
-- 7. PROJECT_STAGES
------------------------------------------------------------
CREATE POLICY "project_stages_select" ON public.project_stages FOR SELECT USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text
  ))
);
CREATE POLICY "project_stages_insert" ON public.project_stages FOR INSERT WITH CHECK (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text
  ))
);
CREATE POLICY "project_stages_update" ON public.project_stages FOR UPDATE USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text
  ))
);
CREATE POLICY "project_stages_delete" ON public.project_stages FOR DELETE USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text
  ))
);

------------------------------------------------------------
-- 8. PROJECT_ASSIGNMENTS
------------------------------------------------------------
CREATE POLICY "project_assignments_select" ON public.project_assignments FOR SELECT USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text
  ))
);
CREATE POLICY "project_assignments_insert" ON public.project_assignments FOR INSERT WITH CHECK (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text
  ))
);
CREATE POLICY "project_assignments_delete" ON public.project_assignments FOR DELETE USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text
  ))
);

------------------------------------------------------------
-- 9. MESSAGES
------------------------------------------------------------
CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text
  ))
);
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text
  ))
);

------------------------------------------------------------
-- 10. FILES
------------------------------------------------------------
CREATE POLICY "files_select" ON public.files FOR SELECT USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text
  ))
);
CREATE POLICY "files_insert" ON public.files FOR INSERT WITH CHECK (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text
  ))
);
CREATE POLICY "files_delete" ON public.files FOR DELETE USING (
  project_id::text IN (SELECT id::text FROM public.projects WHERE team_id::text IN (
    SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text
  ))
);

------------------------------------------------------------
-- 11. TEMPLATES
------------------------------------------------------------
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

------------------------------------------------------------
-- 12. PRESET_STAGES
------------------------------------------------------------
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
