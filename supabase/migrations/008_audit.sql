-- Migration 008: Immutable audit event log

CREATE TYPE actor_type AS ENUM ('user', 'system', 'ai', 'cron', 'webhook');

CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_type actor_type NOT NULL,
  actor_id TEXT, -- user email, 'system', AI tool name, cron job name
  entity_type TEXT NOT NULL, -- 'appointment', 'waitlist', 'offer', 'rule', 'optimization', 'message', etc.
  entity_id UUID,
  action TEXT NOT NULL, -- 'created', 'updated', 'cancelled', 'confirmed', 'sent_message', etc.
  metadata JSONB DEFAULT '{}', -- structured context (old_status, new_status, changes, etc.)
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- INSERT-only: no UPDATE or DELETE allowed via RLS
CREATE INDEX idx_audit_tenant ON audit_events(tenant_id, created_at DESC);
CREATE INDEX idx_audit_entity ON audit_events(tenant_id, entity_type, entity_id);
CREATE INDEX idx_audit_action ON audit_events(tenant_id, action);
CREATE INDEX idx_audit_actor ON audit_events(tenant_id, actor_type);

-- RLS (read-only for tenant users, service role can insert)
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant read only" ON audit_events
  FOR SELECT USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));

-- Prevent UPDATE and DELETE from non-service roles
CREATE POLICY "No updates" ON audit_events
  FOR UPDATE USING (false);

CREATE POLICY "No deletes" ON audit_events
  FOR DELETE USING (false);
