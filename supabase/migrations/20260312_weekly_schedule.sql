-- Add weekly_schedule JSONB column to office_hours_settings
-- Stores the PM's weekly availability template as a JSON array of 7 elements (Sun-Sat)
-- Each element is either null (day disabled) or { "start": "09:00", "end": "17:00" }
ALTER TABLE office_hours_settings
  ADD COLUMN IF NOT EXISTS weekly_schedule jsonb DEFAULT NULL;
