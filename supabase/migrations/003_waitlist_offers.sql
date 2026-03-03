-- Migration 003: Waitlist Offers — tracks slot offers sent to waitlisted patients
-- when an appointment is cancelled or no-showed.

-- Offer status lifecycle: pending → accepted | declined | expired | cancelled
CREATE TYPE offer_status AS ENUM ('pending', 'accepted', 'declined', 'expired', 'cancelled');

CREATE TABLE waitlist_offers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- The appointment that was cancelled/no-showed
  original_appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,

  -- Who was offered
  waitlist_entry_id       UUID NOT NULL REFERENCES waitlist_entries(id) ON DELETE CASCADE,
  patient_id              UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  -- The replacement appointment created on acceptance (NULL until accepted)
  new_appointment_id      UUID REFERENCES appointments(id) ON DELETE SET NULL,

  status                  offer_status NOT NULL DEFAULT 'pending',

  -- Scoring snapshot for audit trail
  smart_score             INT,
  smart_score_breakdown   JSONB,

  -- Security: SHA-256 hash of HMAC token (raw token only sent in email link)
  token_hash              TEXT NOT NULL,

  -- Timing
  offered_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at              TIMESTAMPTZ NOT NULL,
  responded_at            TIMESTAMPTZ,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_waitlist_offers_tenant     ON waitlist_offers(tenant_id);
CREATE INDEX idx_waitlist_offers_status     ON waitlist_offers(tenant_id, status);
CREATE UNIQUE INDEX idx_waitlist_offers_token ON waitlist_offers(token_hash);
CREATE INDEX idx_waitlist_offers_expires    ON waitlist_offers(status, expires_at)
  WHERE status = 'pending';
CREATE INDEX idx_waitlist_offers_original   ON waitlist_offers(original_appointment_id);
CREATE INDEX idx_waitlist_offers_waitlist   ON waitlist_offers(waitlist_entry_id);

-- Auto-update updated_at
CREATE TRIGGER update_waitlist_offers_updated_at
  BEFORE UPDATE ON waitlist_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS: tenant isolation
ALTER TABLE waitlist_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation on waitlist_offers"
  ON waitlist_offers
  FOR ALL
  USING (
    tenant_id IN (
      SELECT id FROM tenants WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM tenants WHERE auth_user_id = auth.uid()
    )
  );
