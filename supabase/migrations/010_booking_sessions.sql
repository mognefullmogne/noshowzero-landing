-- 010: Booking session tables for conversational appointment booking via WhatsApp/SMS
-- booking_sessions: Tracks multi-turn conversation state for appointment booking
-- tenant_phone_numbers: Maps Twilio numbers to tenants for unknown caller resolution

-- ============================================================
-- booking_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS booking_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'sms')),
  state TEXT NOT NULL DEFAULT 'awaiting_service' CHECK (state IN (
    'awaiting_name', 'awaiting_service', 'awaiting_date',
    'awaiting_slot_selection', 'completed', 'expired', 'abandoned'
  )),
  collected_name TEXT,
  collected_service TEXT,
  collected_date_raw TEXT,
  collected_date DATE,
  proposed_slots JSONB,
  selected_slot_index INTEGER,
  selected_slot_id UUID REFERENCES appointment_slots(id) ON DELETE SET NULL,
  created_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial index for active session lookup by phone
CREATE INDEX idx_booking_sessions_active
  ON booking_sessions (phone, state)
  WHERE state NOT IN ('completed', 'expired', 'abandoned');

-- Tenant scoping index
CREATE INDEX idx_booking_sessions_tenant
  ON booking_sessions (tenant_id);

-- Expiration cleanup index
CREATE INDEX idx_booking_sessions_expires
  ON booking_sessions (expires_at)
  WHERE state NOT IN ('completed', 'expired', 'abandoned');

-- RLS
ALTER TABLE booking_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY booking_sessions_tenant_isolation ON booking_sessions
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- ============================================================
-- tenant_phone_numbers
-- ============================================================
CREATE TABLE IF NOT EXISTS tenant_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_phone_numbers_lookup
  ON tenant_phone_numbers (phone_number)
  WHERE is_active = true;

-- RLS
ALTER TABLE tenant_phone_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_phone_numbers_tenant_isolation ON tenant_phone_numbers
  USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);
