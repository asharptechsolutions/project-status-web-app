-- Enable realtime on messages table with full replica identity
-- (required for server-side filters on postgres_changes)
ALTER TABLE messages REPLICA IDENTITY FULL;
