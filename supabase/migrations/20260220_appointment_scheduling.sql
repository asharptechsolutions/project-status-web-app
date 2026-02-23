-- ============ OFFICE HOURS SETTINGS ============

CREATE TABLE IF NOT EXISTS office_hours_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  day_start TIME NOT NULL DEFAULT '09:00',
  day_end TIME NOT NULL DEFAULT '17:00',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id)
);

ALTER TABLE office_hours_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office_hours_settings_all" ON office_hours_settings
  FOR ALL USING (true) WITH CHECK (true);

-- ============ AVAILABILITY SLOTS ============

CREATE TABLE IF NOT EXISTS availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_booked BOOLEAN NOT NULL DEFAULT false,
  recurrence_group_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

ALTER TABLE availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_slots REPLICA IDENTITY FULL;

CREATE POLICY "availability_slots_all" ON availability_slots
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_availability_slots_team_time ON availability_slots(team_id, start_time);

-- ============ APPOINTMENTS ============

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES availability_slots(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(slot_id)
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments REPLICA IDENTITY FULL;

CREATE POLICY "appointments_all" ON appointments
  FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_appointments_team ON appointments(team_id);
CREATE INDEX idx_appointments_client ON appointments(client_id);
