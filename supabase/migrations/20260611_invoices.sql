-- ============ QUOTES & INVOICES ============
-- One table holds both quotes and invoices (kind). A quote can be converted
-- to an invoice in place. Line items are stored as JSONB; totals are stored
-- denormalized so historical documents stay stable if rates change.

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'quote' CHECK (kind IN ('quote', 'invoice')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'paid', 'void')),
  line_items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  notes TEXT,
  payment_url TEXT,
  created_by UUID,
  issued_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_team ON invoices(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id) WHERE project_id IS NOT NULL;

-- ============ RLS ============

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Team members manage their team's invoices
DROP POLICY IF EXISTS "Team members manage invoices" ON invoices;
CREATE POLICY "Team members manage invoices"
  ON invoices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = invoices.team_id
        AND team_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = invoices.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- Assigned clients can read invoices/quotes for their projects (accept/pay
-- happen through server routes with the admin client)
DROP POLICY IF EXISTS "Clients read project invoices" ON invoices;
CREATE POLICY "Clients read project invoices"
  ON invoices FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_clients
      WHERE project_clients.project_id = invoices.project_id
        AND project_clients.client_id = auth.uid()
    )
  );
