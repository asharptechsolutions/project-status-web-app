-- Junction table for many-to-many project <-> client
CREATE TABLE IF NOT EXISTS public.project_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, client_id)
);

-- Enable RLS
ALTER TABLE public.project_clients ENABLE ROW LEVEL SECURITY;

-- RLS policies: access if user is a team member of the project's team
CREATE POLICY "project_clients_select" ON public.project_clients FOR SELECT USING (
  project_id::text IN (
    SELECT p.id::text FROM public.projects p
    WHERE p.team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
  )
);

CREATE POLICY "project_clients_insert" ON public.project_clients FOR INSERT WITH CHECK (
  project_id::text IN (
    SELECT p.id::text FROM public.projects p
    WHERE p.team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
  )
);

CREATE POLICY "project_clients_update" ON public.project_clients FOR UPDATE USING (
  project_id::text IN (
    SELECT p.id::text FROM public.projects p
    WHERE p.team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
  )
);

CREATE POLICY "project_clients_delete" ON public.project_clients FOR DELETE USING (
  project_id::text IN (
    SELECT p.id::text FROM public.projects p
    WHERE p.team_id::text IN (SELECT team_id::text FROM public.team_members WHERE user_id::text = auth.uid()::text)
  )
);
