-- Migration 006: Optimization engine (AI calendar optimization proposals)

CREATE TYPE optimization_type AS ENUM ('gap_fill', 'proactive_reschedule', 'slot_swap', 'load_balance');
CREATE TYPE decision_status AS ENUM ('proposed', 'approved', 'rejected', 'executed', 'expired');

CREATE TABLE optimization_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type optimization_type NOT NULL,
  status decision_status NOT NULL DEFAULT 'proposed',
  description TEXT NOT NULL,
  reasoning TEXT,
  score INTEGER NOT NULL DEFAULT 0, -- 0-100 confidence
  source_appointment_id UUID REFERENCES appointments(id),
  target_slot_id UUID REFERENCES appointment_slots(id),
  target_waitlist_entry_id UUID REFERENCES waitlist_entries(id),
  proposed_changes JSONB NOT NULL DEFAULT '{}', -- structured change proposal
  approved_by TEXT, -- user email or 'auto'
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_optimization_tenant ON optimization_decisions(tenant_id);
CREATE INDEX idx_optimization_status ON optimization_decisions(tenant_id, status);
CREATE INDEX idx_optimization_type ON optimization_decisions(tenant_id, type);
CREATE INDEX idx_optimization_expires ON optimization_decisions(expires_at) WHERE status = 'proposed';

-- RLS
ALTER TABLE optimization_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON optimization_decisions
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));

CREATE TRIGGER optimization_decisions_updated_at
  BEFORE UPDATE ON optimization_decisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
