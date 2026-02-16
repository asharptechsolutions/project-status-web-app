-- COMPREHENSIVE RLS FIX v2
-- Drops ALL existing policies, recreates clean ones.

------------------------------------------------------------
-- 1. DISABLE RLS temporarily to avoid issues during cleanup
------------------------------------------------------------
ALTER TABLE IF EXISTS public.teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.team_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.project_stages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.project_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.files DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.preset_stages DISABLE ROW LEVEL SECURITY;

------------------------------------------------------------
-- 2. DROP ALL KNOWN POLICIES
------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('teams','profiles','team_members','projects','project_stages',
                         'project_assignments','messages','files','templates','preset_stages',
                         'members','organizations','platform_admins')
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

------------------------------------------------------------
-- 3. RE-ENABLE RLS
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
-- 4. TEAMS
------------------------------------------------------------
CREATE POLICY "teams_select" ON public.teams FOR SELECT USING (
  created_by = auth.uid() OR
  id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "teams_insert" ON public.teams FOR INSERT WITH CHECK (
  auth.uid() = created_by
);
CREATE POLICY "teams_update" ON public.teams FOR UPDATE USING (
  created_by = auth.uid()
);

------------------------------------------------------------
-- 5. PROFILES
------------------------------------------------------------
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (
  id = auth.uid()
);
CREATE POLICY "profiles_select_team" ON public.profiles FOR SELECT USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (
  id = auth.uid()
);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (
  id = auth.uid()
);

------------------------------------------------------------
-- 6. TEAM_MEMBERS (no self-referencing!)
------------------------------------------------------------
CREATE POLICY "team_members_select" ON public.team_members FOR SELECT USING (
  user_id = auth.uid()
);
CREATE POLICY "team_members_insert" ON public.team_members FOR INSERT WITH CHECK (
  user_id = auth.uid()
);
CREATE POLICY "team_members_update" ON public.team_members FOR UPDATE USING (
  user_id = auth.uid()
);
CREATE POLICY "team_members_delete" ON public.team_members FOR DELETE USING (
  user_id = auth.uid()
);

------------------------------------------------------------
-- 7. PROJECTS
------------------------------------------------------------
CREATE POLICY "projects_select" ON public.projects FOR SELECT USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "projects_insert" ON public.projects FOR INSERT WITH CHECK (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "projects_update" ON public.projects FOR UPDATE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "projects_delete" ON public.projects FOR DELETE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);

------------------------------------------------------------
-- 8. PROJECT_STAGES
------------------------------------------------------------
CREATE POLICY "project_stages_select" ON public.project_stages FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "project_stages_insert" ON public.project_stages FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "project_stages_update" ON public.project_stages FOR UPDATE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "project_stages_delete" ON public.project_stages FOR DELETE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  ))
);

------------------------------------------------------------
-- 9. PROJECT_ASSIGNMENTS
------------------------------------------------------------
CREATE POLICY "project_assignments_select" ON public.project_assignments FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "project_assignments_insert" ON public.project_assignments FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "project_assignments_delete" ON public.project_assignments FOR DELETE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  ))
);

------------------------------------------------------------
-- 10. MESSAGES
------------------------------------------------------------
CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  ))
);

------------------------------------------------------------
-- 11. FILES
------------------------------------------------------------
CREATE POLICY "files_select" ON public.files FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "files_insert" ON public.files FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "files_delete" ON public.files FOR DELETE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (
    SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
  ))
);

------------------------------------------------------------
-- 12. TEMPLATES
------------------------------------------------------------
CREATE POLICY "templates_select" ON public.templates FOR SELECT USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "templates_insert" ON public.templates FOR INSERT WITH CHECK (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "templates_update" ON public.templates FOR UPDATE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "templates_delete" ON public.templates FOR DELETE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);

------------------------------------------------------------
-- 13. PRESET_STAGES
------------------------------------------------------------
CREATE POLICY "preset_stages_select" ON public.preset_stages FOR SELECT USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "preset_stages_insert" ON public.preset_stages FOR INSERT WITH CHECK (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "preset_stages_update" ON public.preset_stages FOR UPDATE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "preset_stages_delete" ON public.preset_stages FOR DELETE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
