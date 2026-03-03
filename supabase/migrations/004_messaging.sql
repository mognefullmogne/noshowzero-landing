-- Migration 004: Messaging infrastructure (WhatsApp/SMS 2-way conversations)

-- Enums
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE intent_source AS ENUM ('regex', 'ai', 'manual');
CREATE TYPE delivery_status_enum AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed', 'undelivered');

-- Message threads (one per patient-tenant pair per channel)
CREATE TABLE message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  channel message_channel NOT NULL DEFAULT 'whatsapp',
  external_thread_id TEXT, -- Twilio conversation SID if applicable
  last_message_at TIMESTAMPTZ,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, patient_id, channel)
);

CREATE INDEX idx_message_threads_tenant ON message_threads(tenant_id);
CREATE INDEX idx_message_threads_patient ON message_threads(patient_id);
CREATE INDEX idx_message_threads_last_msg ON message_threads(tenant_id, last_message_at DESC);

-- Message events (individual messages within a thread)
CREATE TABLE message_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  direction message_direction NOT NULL,
  channel message_channel NOT NULL,
  body TEXT NOT NULL,
  from_number TEXT,
  to_number TEXT,
  external_sid TEXT, -- Twilio message SID
  intent TEXT, -- classified intent: confirm, cancel, accept_offer, decline_offer, slot_select, question, unknown
  intent_confidence REAL, -- 0.0 to 1.0
  intent_source intent_source,
  context_appointment_id UUID REFERENCES appointments(id),
  context_offer_id UUID REFERENCES waitlist_offers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_events_thread ON message_events(thread_id, created_at ASC);
CREATE INDEX idx_message_events_tenant ON message_events(tenant_id);
CREATE INDEX idx_message_events_external ON message_events(external_sid);

-- Delivery statuses (webhook updates from Twilio)
CREATE TABLE delivery_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_event_id UUID NOT NULL REFERENCES message_events(id) ON DELETE CASCADE,
  status delivery_status_enum NOT NULL,
  error_code TEXT,
  error_message TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_delivery_statuses_event ON delivery_statuses(message_event_id);

-- RLS
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON message_threads
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));

CREATE POLICY "Tenant isolation" ON message_events
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));

CREATE POLICY "Tenant isolation" ON delivery_statuses
  FOR ALL USING (
    message_event_id IN (
      SELECT id FROM message_events WHERE tenant_id IN (
        SELECT id FROM tenants WHERE auth_user_id = auth.uid()
      )
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER message_threads_updated_at
  BEFORE UPDATE ON message_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
