-- ============================================================================
-- Harden RLS on the appointment-scheduling tables.
--
-- The original 20260220_appointment_scheduling migration shipped these tables
-- with permissive `USING (true) WITH CHECK (true)` policies, which allow any
-- authenticated user to read/write any org's office hours, availability slots,
-- and appointments. Cross-tenant isolation was only ever enforced by the
-- app-layer `.eq("team_id", ...)` filters — and `getAppointment(id)` (used by
-- the /meet video page) didn't even filter by team, so any user who knew an
-- appointment UUID could load it and join the call.
--
-- These tables are all keyed by team_id, and clients are themselves rows in
-- team_members (role = 'client'), so a single team-membership policy correctly
-- scopes admins, workers, AND clients to their own org — matching the pattern
-- used by the invoices / feedback / automation_settings migrations.
-- ============================================================================

-- ---------- office_hours_settings ----------
DROP POLICY IF EXISTS "office_hours_settings_all" ON office_hours_settings;

CREATE POLICY "office_hours_settings_team_access" ON office_hours_settings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = office_hours_settings.team_id
        AND team_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = office_hours_settings.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- ---------- availability_slots ----------
-- Clients need SELECT (to see open slots) and UPDATE (booking flips is_booked).
-- Team membership covers all of read/insert/update/delete within the org.
DROP POLICY IF EXISTS "availability_slots_all" ON availability_slots;

CREATE POLICY "availability_slots_team_access" ON availability_slots
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = availability_slots.team_id
        AND team_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = availability_slots.team_id
        AND team_members.user_id = auth.uid()
    )
  );

-- ---------- appointments ----------
-- Clients book (INSERT), view (SELECT), and cancel (UPDATE status) their own
-- appointments; admins/workers manage all of the org's. All are team members.
DROP POLICY IF EXISTS "appointments_all" ON appointments;

CREATE POLICY "appointments_team_access" ON appointments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = appointments.team_id
        AND team_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = appointments.team_id
        AND team_members.user_id = auth.uid()
    )
  );
