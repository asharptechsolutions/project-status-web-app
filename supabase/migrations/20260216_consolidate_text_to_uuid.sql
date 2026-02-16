-- Consolidated migration: Convert all text-based Clerk columns to uuid for Supabase Auth
-- This is idempotent — safe to run multiple times.
-- Replaces all previous piecemeal migration attempts.

BEGIN;

-- ============================================================
-- HELPER: Check if a column exists and is of a given type
-- ============================================================

-- ============================================================
-- 1. DROP ALL RLS POLICIES on affected tables (idempotent)
-- ============================================================
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'projects', 'project_stages', 'project_assignments',
        'messages', 'files', 'templates', 'preset_stages',
        'clients', 'project_clients',
        'organizations', 'members', 'platform_admins'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ============================================================
-- 2. DROP ALL FK CONSTRAINTS on affected tables
-- ============================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tc.constraint_name, tc.table_name
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name IN (
        'projects', 'project_stages', 'project_assignments',
        'messages', 'files', 'templates', 'preset_stages',
        'clients', 'project_clients', 'members'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
  END LOOP;
END $$;

-- ============================================================
-- 3. RENAME COLUMNS (org_id → team_id, clerk_user_id → user_id, etc.)
--    Only if old column exists and new one doesn't
-- ============================================================
DO $$
BEGIN
  -- projects: org_id → team_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='org_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='team_id') THEN
    ALTER TABLE public.projects RENAME COLUMN org_id TO team_id;
  END IF;

  -- templates: org_id → team_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='templates' AND column_name='org_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='templates' AND column_name='team_id') THEN
    ALTER TABLE public.templates RENAME COLUMN org_id TO team_id;
  END IF;

  -- preset_stages: org_id → team_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='preset_stages' AND column_name='org_id')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='preset_stages' AND column_name='team_id') THEN
    ALTER TABLE public.preset_stages RENAME COLUMN org_id TO team_id;
  END IF;

  -- messages: sender_id stays as sender_id (just type change)
  -- files: uploaded_by stays (just type change)
  -- project_stages: started_by stays (just type change)
  -- projects: created_by stays (just type change)
END $$;

-- ============================================================
-- 4. ALTER COLUMN TYPES from text → uuid
--    Using USING col::uuid for data conversion
-- ============================================================

-- projects
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='team_id' AND data_type='text') THEN
    ALTER TABLE public.projects ALTER COLUMN team_id TYPE uuid USING team_id::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='created_by' AND data_type='text') THEN
    ALTER TABLE public.projects ALTER COLUMN created_by TYPE uuid USING created_by::uuid;
  END IF;
END $$;

-- Add client columns to projects if missing
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_name text DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_email text DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_phone text DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_id uuid;

-- project_stages
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='project_stages' AND column_name='started_by' AND data_type='text') THEN
    ALTER TABLE public.project_stages ALTER COLUMN started_by TYPE uuid USING NULLIF(started_by, '')::uuid;
  END IF;
END $$;

-- messages
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='sender_id' AND data_type='text') THEN
    ALTER TABLE public.messages ALTER COLUMN sender_id TYPE uuid USING sender_id::uuid;
  END IF;
END $$;

-- files
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='files' AND column_name='uploaded_by' AND data_type='text') THEN
    ALTER TABLE public.files ALTER COLUMN uploaded_by TYPE uuid USING uploaded_by::uuid;
  END IF;
END $$;

-- templates
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='templates' AND column_name='team_id' AND data_type='text') THEN
    ALTER TABLE public.templates ALTER COLUMN team_id TYPE uuid USING team_id::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='templates' AND column_name='created_by' AND data_type='text') THEN
    ALTER TABLE public.templates ALTER COLUMN created_by TYPE uuid USING created_by::uuid;
  END IF;
END $$;

-- preset_stages
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='preset_stages' AND column_name='team_id' AND data_type='text') THEN
    ALTER TABLE public.preset_stages ALTER COLUMN team_id TYPE uuid USING team_id::uuid;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='preset_stages' AND column_name='created_by' AND data_type='text') THEN
    ALTER TABLE public.preset_stages ALTER COLUMN created_by TYPE uuid USING created_by::uuid;
  END IF;
END $$;

-- ============================================================
-- 5. CREATE clients and project_clients tables IF NOT EXISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  name text NOT NULL,
  email text,
  phone text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  client_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, client_id)
);

-- ============================================================
-- 6. RE-ADD FK CONSTRAINTS
-- ============================================================

-- projects → teams
ALTER TABLE public.projects
  ADD CONSTRAINT fk_projects_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- projects → clients (optional)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='client_id') THEN
    ALTER TABLE public.projects ADD CONSTRAINT fk_projects_client FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
END $$;

-- project_stages → projects
ALTER TABLE public.project_stages
  ADD CONSTRAINT fk_project_stages_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- project_assignments → projects
ALTER TABLE public.project_assignments
  ADD CONSTRAINT fk_project_assignments_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- messages → projects
ALTER TABLE public.messages
  ADD CONSTRAINT fk_messages_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- files → projects
ALTER TABLE public.files
  ADD CONSTRAINT fk_files_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- templates → teams
ALTER TABLE public.templates
  ADD CONSTRAINT fk_templates_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- preset_stages → teams
ALTER TABLE public.preset_stages
  ADD CONSTRAINT fk_preset_stages_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- clients → teams
ALTER TABLE public.clients
  ADD CONSTRAINT fk_clients_team FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- clients → auth.users
ALTER TABLE public.clients
  ADD CONSTRAINT fk_clients_created_by FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- project_clients → projects
ALTER TABLE public.project_clients
  ADD CONSTRAINT fk_project_clients_project FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

-- project_clients → clients
ALTER TABLE public.project_clients
  ADD CONSTRAINT fk_project_clients_client FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- ============================================================
-- 7. ENABLE RLS on all tables
-- ============================================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preset_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_clients ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 8. RECREATE RLS POLICIES (team-based access via team_members)
-- ============================================================

-- Helper: user's teams subquery
-- (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())

-- projects
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

-- project_stages (via project → team)
CREATE POLICY "project_stages_select" ON public.project_stages FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "project_stages_insert" ON public.project_stages FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "project_stages_update" ON public.project_stages FOR UPDATE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "project_stages_delete" ON public.project_stages FOR DELETE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);

-- project_assignments (via project → team)
CREATE POLICY "project_assignments_select" ON public.project_assignments FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "project_assignments_insert" ON public.project_assignments FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "project_assignments_update" ON public.project_assignments FOR UPDATE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "project_assignments_delete" ON public.project_assignments FOR DELETE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);

-- messages (via project → team)
CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "messages_update" ON public.messages FOR UPDATE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "messages_delete" ON public.messages FOR DELETE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);

-- files (via project → team)
CREATE POLICY "files_select" ON public.files FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "files_insert" ON public.files FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "files_update" ON public.files FOR UPDATE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "files_delete" ON public.files FOR DELETE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);

-- templates (team-based)
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

-- preset_stages (team-based)
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

-- clients (team-based)
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

-- project_clients (via project → team)
CREATE POLICY "project_clients_select" ON public.project_clients FOR SELECT USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "project_clients_insert" ON public.project_clients FOR INSERT WITH CHECK (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "project_clients_update" ON public.project_clients FOR UPDATE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);
CREATE POLICY "project_clients_delete" ON public.project_clients FOR DELETE USING (
  project_id IN (SELECT id FROM public.projects WHERE team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid()))
);

-- ============================================================
-- 9. DROP legacy tables that are no longer needed
-- ============================================================
-- Keep organizations and members for now (may have data), but they're unused by the app.
-- DROP TABLE IF EXISTS public.platform_admins CASCADE;
-- DROP TABLE IF EXISTS public.members CASCADE;
-- DROP TABLE IF EXISTS public.organizations CASCADE;

COMMIT;
