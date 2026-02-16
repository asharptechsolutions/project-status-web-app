-- Fix: infinite recursion in team_members RLS policies
-- The old policies on team_members queried team_members itself for access checks

-- Drop the recursive policies
DROP POLICY IF EXISTS "Members can view their team members" ON public.team_members;
DROP POLICY IF EXISTS "Owners can manage team members" ON public.team_members;
DROP POLICY IF EXISTS "Users can insert themselves" ON public.team_members;

-- Also fix teams/profiles policies that reference team_members
DROP POLICY IF EXISTS "Users can view their teams" ON public.teams;
DROP POLICY IF EXISTS "Users can view team profiles" ON public.profiles;

-- Recreate without recursion
CREATE POLICY "Members can view their team members" ON public.team_members
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Owners can manage team members" ON public.team_members
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can insert themselves" ON public.team_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their teams" ON public.teams
  FOR SELECT USING (
    id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view team profiles" ON public.profiles
  FOR SELECT USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  );
