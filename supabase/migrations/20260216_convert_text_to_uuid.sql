-- NUCLEAR FIX: Convert all text columns to uuid and fix all FKs
-- Safe: all tables are empty (fresh migration)

-- Step 1: Drop ALL policies
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Step 2: Drop all stale FK constraints that reference old types
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_org_id_fkey;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_team_id_fkey;
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_created_by_fkey;
ALTER TABLE public.project_stages DROP CONSTRAINT IF EXISTS project_stages_project_id_fkey;
ALTER TABLE public.project_stages DROP CONSTRAINT IF EXISTS project_stages_org_id_fkey;
ALTER TABLE public.project_stages DROP CONSTRAINT IF EXISTS project_stages_team_id_fkey;
ALTER TABLE public.project_assignments DROP CONSTRAINT IF EXISTS project_assignments_project_id_fkey;
ALTER TABLE public.project_assignments DROP CONSTRAINT IF EXISTS project_assignments_org_id_fkey;
ALTER TABLE public.project_assignments DROP CONSTRAINT IF EXISTS project_assignments_team_id_fkey;
ALTER TABLE public.project_assignments DROP CONSTRAINT IF EXISTS project_assignments_user_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_project_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_org_id_fkey;
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_team_id_fkey;
ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_project_id_fkey;
ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_org_id_fkey;
ALTER TABLE public.files DROP CONSTRAINT IF EXISTS files_team_id_fkey;
ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_org_id_fkey;
ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS templates_team_id_fkey;
ALTER TABLE public.preset_stages DROP CONSTRAINT IF EXISTS preset_stages_org_id_fkey;
ALTER TABLE public.preset_stages DROP CONSTRAINT IF EXISTS preset_stages_team_id_fkey;
ALTER TABLE public.preset_stages DROP CONSTRAINT IF EXISTS preset_stages_template_id_fkey;

-- Step 3: Convert text columns to uuid on each table
-- projects
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='team_id' AND data_type='text') THEN
    ALTER TABLE public.projects ALTER COLUMN team_id TYPE uuid USING team_id::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='id' AND data_type='text') THEN
    ALTER TABLE public.projects ALTER COLUMN id TYPE uuid USING id::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='created_by' AND data_type='text') THEN
    ALTER TABLE public.projects ALTER COLUMN created_by TYPE uuid USING created_by::uuid;
  END IF;
END $$;

-- project_stages
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='project_stages' AND column_name='project_id' AND data_type='text') THEN
    ALTER TABLE public.project_stages ALTER COLUMN project_id TYPE uuid USING project_id::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='project_stages' AND column_name='id' AND data_type='text') THEN
    ALTER TABLE public.project_stages ALTER COLUMN id TYPE uuid USING id::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='project_stages' AND column_name='team_id' AND data_type='text') THEN
    ALTER TABLE public.project_stages ALTER COLUMN team_id TYPE uuid USING team_id::uuid;
  END IF;
END $$;

-- project_assignments
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='project_assignments' AND column_name='project_id' AND data_type='text') THEN
    ALTER TABLE public.project_assignments ALTER COLUMN project_id TYPE uuid USING project_id::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='project_assignments' AND column_name='team_id' AND data_type='text') THEN
    ALTER TABLE public.project_assignments ALTER COLUMN team_id TYPE uuid USING team_id::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='project_assignments' AND column_name='user_id' AND data_type='text') THEN
    ALTER TABLE public.project_assignments ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
  END IF;
END $$;

-- messages
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='project_id' AND data_type='text') THEN
    ALTER TABLE public.messages ALTER COLUMN project_id TYPE uuid USING project_id::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='team_id' AND data_type='text') THEN
    ALTER TABLE public.messages ALTER COLUMN team_id TYPE uuid USING team_id::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='sender_id' AND data_type='text') THEN
    ALTER TABLE public.messages ALTER COLUMN sender_id TYPE uuid USING sender_id::uuid;
  END IF;
END $$;

-- files
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='files' AND column_name='project_id' AND data_type='text') THEN
    ALTER TABLE public.files ALTER COLUMN project_id TYPE uuid USING project_id::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='files' AND column_name='team_id' AND data_type='text') THEN
    ALTER TABLE public.files ALTER COLUMN team_id TYPE uuid USING team_id::uuid;
  END IF;
END $$;

-- templates
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='templates' AND column_name='team_id' AND data_type='text') THEN
    ALTER TABLE public.templates ALTER COLUMN team_id TYPE uuid USING team_id::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='templates' AND column_name='id' AND data_type='text') THEN
    ALTER TABLE public.templates ALTER COLUMN id TYPE uuid USING id::uuid;
  END IF;
END $$;

-- preset_stages
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='preset_stages' AND column_name='team_id' AND data_type='text') THEN
    ALTER TABLE public.preset_stages ALTER COLUMN team_id TYPE uuid USING team_id::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='preset_stages' AND column_name='template_id' AND data_type='text') THEN
    ALTER TABLE public.preset_stages ALTER COLUMN template_id TYPE uuid USING template_id::uuid;
  END IF;
END $$;

-- Step 4: Re-add FK constraints
ALTER TABLE public.projects ADD CONSTRAINT projects_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
ALTER TABLE public.project_stages ADD CONSTRAINT project_stages_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
ALTER TABLE public.templates ADD CONSTRAINT templates_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
ALTER TABLE public.preset_stages ADD CONSTRAINT preset_stages_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE CASCADE;

-- Step 5: Add FK from team_members to profiles (for PostgREST joins)
ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_user_id_profiles_fkey;
ALTER TABLE public.team_members ADD CONSTRAINT team_members_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id);

-- Step 6: Recreate all RLS policies (now with native uuid, no casts needed)
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- TEAMS
CREATE POLICY "teams_select" ON public.teams FOR SELECT USING (
  created_by = auth.uid() OR id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "teams_insert" ON public.teams FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "teams_update" ON public.teams FOR UPDATE USING (created_by = auth.uid());

-- PROFILES
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_select_team" ON public.profiles FOR SELECT USING (
  id IN (SELECT user_id FROM public.team_members WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- TEAM_MEMBERS
CREATE POLICY "tm_select" ON public.team_members FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "tm_select_team" ON public.team_members FOR SELECT USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "tm_insert" ON public.team_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "tm_delete" ON public.team_members FOR DELETE USING (user_id = auth.uid());

-- PROJECTS
CREATE POLICY "proj_select" ON public.projects FOR SELECT USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "proj_insert" ON public.projects FOR INSERT WITH CHECK (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "proj_update" ON public.projects FOR UPDATE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "proj_delete" ON public.projects FOR DELETE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);

-- PROJECT_STAGES
CREATE POLICY "ps_select" ON public.project_stages FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "ps_insert" ON public.project_stages FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "ps_update" ON public.project_stages FOR UPDATE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "ps_delete" ON public.project_stages FOR DELETE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);

-- PROJECT_ASSIGNMENTS
CREATE POLICY "pa_select" ON public.project_assignments FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "pa_insert" ON public.project_assignments FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "pa_delete" ON public.project_assignments FOR DELETE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);

-- MESSAGES
CREATE POLICY "msg_select" ON public.messages FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "msg_insert" ON public.messages FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);

-- FILES
CREATE POLICY "files_select" ON public.files FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "files_insert" ON public.files FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "files_delete" ON public.files FOR DELETE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);

-- TEMPLATES
CREATE POLICY "tpl_select" ON public.templates FOR SELECT USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "tpl_insert" ON public.templates FOR INSERT WITH CHECK (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "tpl_update" ON public.templates FOR UPDATE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "tpl_delete" ON public.templates FOR DELETE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);

-- PRESET_STAGES
CREATE POLICY "prs_select" ON public.preset_stages FOR SELECT USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "prs_insert" ON public.preset_stages FOR INSERT WITH CHECK (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "prs_update" ON public.preset_stages FOR UPDATE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "prs_delete" ON public.preset_stages FOR DELETE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);

-- CLIENTS
CREATE POLICY "clients_select" ON public.clients FOR SELECT USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "clients_insert" ON public.clients FOR INSERT WITH CHECK (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "clients_update" ON public.clients FOR UPDATE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);
CREATE POLICY "clients_delete" ON public.clients FOR DELETE USING (
  team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
