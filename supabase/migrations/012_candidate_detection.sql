-- Migration 012: Candidate Detection — switch from waitlist-entry-based to appointment-based candidates

-- Make waitlist_entry_id nullable (candidates now come from appointments, not waitlist_entries)
ALTER TABLE waitlist_offers
  ALTER COLUMN waitlist_entry_id DROP NOT NULL;

-- Add reference to the candidate's current appointment (the one being moved earlier)
ALTER TABLE waitlist_offers
  ADD COLUMN candidate_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL;

-- Index for 24-hour decline cooldown queries: find patients who declined recently
CREATE INDEX idx_waitlist_offers_declined_recent
  ON waitlist_offers(tenant_id, patient_id, responded_at)
  WHERE status = 'declined';

-- Index for candidate query: future scheduled appointments by tenant
CREATE INDEX idx_appointments_candidate_lookup
  ON appointments(tenant_id, status, scheduled_at)
  WHERE status IN ('scheduled', 'reminder_pending', 'reminder_sent', 'confirmed');
