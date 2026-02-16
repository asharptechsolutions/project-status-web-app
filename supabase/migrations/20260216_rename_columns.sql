-- Comprehensive column/table rename: Clerk → Supabase Auth
-- Run this ONCE to align the database with the updated codebase

-- 1. Rename org_id → team_id on all tables that have it
DO $$
BEGIN
  -- projects
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='projects' AND column_name='org_id') THEN
    ALTER TABLE public.projects RENAME COLUMN org_id TO team_id;
  END IF;

  -- templates
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='templates' AND column_name='org_id') THEN
    ALTER TABLE public.templates RENAME COLUMN org_id TO team_id;
  END IF;

  -- preset_stages
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='preset_stages' AND column_name='org_id') THEN
    ALTER TABLE public.preset_stages RENAME COLUMN org_id TO team_id;
  END IF;

  -- project_assignments
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='project_assignments' AND column_name='org_id') THEN
    ALTER TABLE public.project_assignments RENAME COLUMN org_id TO team_id;
  END IF;

  -- messages
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='org_id') THEN
    ALTER TABLE public.messages RENAME COLUMN org_id TO team_id;
  END IF;

  -- files
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='files' AND column_name='org_id') THEN
    ALTER TABLE public.files RENAME COLUMN org_id TO team_id;
  END IF;
END $$;

-- 2. Rename clerk_user_id → user_id on members table (if it still exists as old table)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name='clerk_user_id') THEN
    ALTER TABLE public.members RENAME COLUMN clerk_user_id TO user_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='members' AND column_name='org_id') THEN
    ALTER TABLE public.members RENAME COLUMN org_id TO team_id;
  END IF;
END $$;

-- 3. Rename platform_admins.clerk_user_id if that table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='platform_admins' AND column_name='clerk_user_id') THEN
    ALTER TABLE public.platform_admins RENAME COLUMN clerk_user_id TO user_id;
  END IF;
END $$;
