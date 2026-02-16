-- Create clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Add client_id to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- RLS policies for clients (team-based access)
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
