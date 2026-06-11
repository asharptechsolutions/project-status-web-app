-- ============ RICHER CLIENT NOTIFICATION PREFERENCES ============
-- Expand the single notify_stage_complete boolean into a per-event matrix.
-- Existing rows keep their stage-complete preference; new event types
-- default to on (clients opt out, not in).

ALTER TABLE client_notification_preferences
  ADD COLUMN IF NOT EXISTS notify_stage_started BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE client_notification_preferences
  ADD COLUMN IF NOT EXISTS notify_approval_requested BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE client_notification_preferences
  ADD COLUMN IF NOT EXISTS notify_photo_added BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE client_notification_preferences
  ADD COLUMN IF NOT EXISTS notify_project_completed BOOLEAN NOT NULL DEFAULT true;
