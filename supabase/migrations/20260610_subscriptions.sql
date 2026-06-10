-- ============ STRIPE BILLING ============
-- One subscription row per team, written exclusively by the Stripe webhook
-- (service role). Team members can read their own team's row.

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
  ON subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ============ RLS ============

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Team members can read their team's subscription
DROP POLICY IF EXISTS "Team members can view subscription" ON subscriptions;
CREATE POLICY "Team members can view subscription"
  ON subscriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = subscriptions.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- No INSERT/UPDATE/DELETE policies: only the service role (webhook) writes
