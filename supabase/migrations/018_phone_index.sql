-- Add index on patients.phone for fast webhook lookups.
-- Every inbound WhatsApp message queries patients by phone — without this,
-- it's a sequential scan on every webhook hit.
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients (phone);

-- Add index for Supabase-backed rate limiting.
-- Rate limit query counts inbound messages per phone in the last 60 seconds.
CREATE INDEX IF NOT EXISTS idx_message_events_ratelimit
  ON message_events (from_number, direction, created_at DESC)
  WHERE direction = 'inbound';
