-- Migration 014: Intelligence Layer
-- Adds response pattern tracking on patients and indexes for intelligence queries.

-- 1. Response patterns JSONB column on patients (Feature 1)
-- Stores rolling window of response records for optimal contact timing.
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS response_patterns JSONB DEFAULT NULL;

-- 2. Index for no-show detection queries (Feature 4a)
-- Efficiently finds overdue confirmed/scheduled appointments.
CREATE INDEX IF NOT EXISTS idx_appointments_noshow_detection
  ON appointments(tenant_id, status, scheduled_at)
  WHERE status IN ('confirmed', 'scheduled');

-- 3. Index for historical slot analysis (Feature 3 + 4b)
-- Efficiently queries appointment outcomes grouped by day/hour.
CREATE INDEX IF NOT EXISTS idx_appointments_historical_analysis
  ON appointments(tenant_id, status, scheduled_at);

-- 4. Comment for documentation
COMMENT ON COLUMN patients.response_patterns IS
  'JSONB: { records: [{ channel, sentAt, respondedAt, responseMinutes, hourOfDay, dayOfWeek }], updatedAt }. Rolling window of last 50 response events for optimal contact timing.';
