-- COMPREHENSIVE RLS FIX
-- Drops ALL existing policies on ALL app tables, then recreates clean ones.
-- Run this ONCE in Supabase SQL Editor.

------------------------------------------------------------
-- 1. DROP ALL EXISTING POLICIES
------------------------------------------------------------

-- teams
DO $$ BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='teams') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.teams', r.policyname);
  END LOOP;
END $$;

-- profiles
DO $$ BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='profiles') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
END $$;

-- team_members
DO $$ BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='team_members') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.team_members', r.policyname);
  END LOOP;
END $$;

-- projects
DO $$ BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='projects') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.projects', r.policyname);
  END LOOP;
END $$;

-- project_stages
DO $$ BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_stages') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_stages', r.policyname);
  END LOOP;
END $$;

-- project_assignments
DO $$ BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='project_assignments') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.project_assignments', r.policyname);
  END LOOP;
END $$;

-- messages
DO $$ BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='messages') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.messages', r.policyname);
  END LOOP;
END $$;

-- files
DO $$ BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='files') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.files', r.policyname);
  END LOOP;
END $$;

-- templates
DO $$ BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='templates') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.templates', r.policyname);
  END LOOP;
END $$;

-- preset_stages
DO $$ BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='preset_stages') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.preset_stages', r.policyname);
  END LOOP;
END $$;

-- members (old table, if exists)
DO $$ BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='members') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.members', r.policyname);
  END LOOP;
END $$;

-- organizations (old table, if exists)
DO $$ BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='organizations') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.organizations', r.policyname);
  END LOOP;
END $$;

------------------------------------------------------------
-- 2. ENABLE RLS ON ALL TABLES
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
-- 3. TEAMS policies
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
-- 4. PROFILES policies
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
-- 5. TEAM_MEMBERS policies (no self-referencing!)
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
-- 6. PROJECTS policies (team-based access)
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
-- 7. PROJECT_STAGES policies (access via project's team)
------------------------------------------------------------
CREATE POLICY "project_stages_select" ON public.project_stages FOR SELECT USING (
  project_id IN (
    SELECT id FROM public.projects WHERE team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "project_stages_insert" ON public.project_stages FOR INSERT WITH CHECK (
  project_id IN (
    SELECT id FROM public.projects WHERE team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "project_stages_update" ON public.project_stages FOR UPDATE USING (
  project_id IN (
    SELECT id FROM public.projects WHERE team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "project_stages_delete" ON public.project_stages FOR DELETE USING (
  project_id IN (
    SELECT id FROM public.projects WHERE team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  )
);

------------------------------------------------------------
-- 8. PROJECT_ASSIGNMENTS policies
------------------------------------------------------------
CREATE POLICY "project_assignments_select" ON public.project_assignments FOR SELECT USING (
  project_id IN (
    SELECT id FROM public.projects WHERE team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "project_assignments_insert" ON public.project_assignments FOR INSERT WITH CHECK (
  project_id IN (
    SELECT id FROM public.projects WHERE team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "project_assignments_delete" ON public.project_assignments FOR DELETE USING (
  project_id IN (
    SELECT id FROM public.projects WHERE team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  )
);

------------------------------------------------------------
-- 9. MESSAGES policies
------------------------------------------------------------
CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (
  project_id IN (
    SELECT id FROM public.projects WHERE team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (
  project_id IN (
    SELECT id FROM public.projects WHERE team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  )
);

------------------------------------------------------------
-- 10. FILES policies
------------------------------------------------------------
CREATE POLICY "files_select" ON public.files FOR SELECT USING (
  project_id IN (
    SELECT id FROM public.projects WHERE team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "files_insert" ON public.files FOR INSERT WITH CHECK (
  project_id IN (
    SELECT id FROM public.projects WHERE team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "files_delete" ON public.files FOR DELETE USING (
  project_id IN (
    SELECT id FROM public.projects WHERE team_id IN (
      SELECT team_id FROM public.team_members WHERE user_id = auth.uid()
    )
  )
);

------------------------------------------------------------
-- 11. TEMPLATES policies
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
-- 12. PRESET_STAGES policies
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
