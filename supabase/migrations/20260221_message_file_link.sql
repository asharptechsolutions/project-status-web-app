-- Link messages to files for inline file attachments in chat
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES files(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_messages_file_id ON messages(file_id);
