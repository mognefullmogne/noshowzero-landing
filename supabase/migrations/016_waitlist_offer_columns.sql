-- Migration 016: Add candidate_appointment_id and smart_score_breakdown to waitlist_offers
-- These columns support chain cascade (freeing candidate's original appointment on accept)
-- and detailed scoring transparency.

ALTER TABLE waitlist_offers
  ADD COLUMN IF NOT EXISTS candidate_appointment_id uuid REFERENCES appointments(id),
  ADD COLUMN IF NOT EXISTS smart_score_breakdown jsonb;

COMMENT ON COLUMN waitlist_offers.candidate_appointment_id IS
  'For appointment-sourced candidates: the appointment they would vacate on accept (enables chain cascade). Null for waitlist-sourced candidates.';
COMMENT ON COLUMN waitlist_offers.smart_score_breakdown IS
  'Full CandidateScoreBreakdown JSON: { total, appointmentDistance, reliability, urgencyBonus, responsiveness }';
