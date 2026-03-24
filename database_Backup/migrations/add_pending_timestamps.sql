-- Add timestamps for pending lots and email reminders
ALTER TABLE lots 
ADD COLUMN pending_since DATETIME NULL,
ADD COLUMN last_reminder_sent DATETIME NULL;

-- Add index for better performance on pending_since
CREATE INDEX idx_lots_pending_since ON lots(pending_since);
