-- Migration 005: Appointment slots (provider schedule grid)

CREATE TYPE slot_status AS ENUM ('available', 'booked', 'blocked', 'cancelled');

CREATE TABLE appointment_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  location_name TEXT,
  service_code TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status slot_status NOT NULL DEFAULT 'available',
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  block_reason TEXT, -- reason if status='blocked'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_at > start_at)
);

CREATE INDEX idx_slots_tenant ON appointment_slots(tenant_id);
CREATE INDEX idx_slots_provider ON appointment_slots(tenant_id, provider_name, start_at);
CREATE INDEX idx_slots_status ON appointment_slots(tenant_id, status, start_at);
CREATE INDEX idx_slots_appointment ON appointment_slots(appointment_id);

-- RLS
ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON appointment_slots
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));

CREATE TRIGGER appointment_slots_updated_at
  BEFORE UPDATE ON appointment_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
