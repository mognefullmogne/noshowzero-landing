-- =============================================================
-- NoShowZero: All Migrations (004-011) + Realtime Publication
-- Paste this entire script in Supabase Dashboard > SQL Editor
-- Fully idempotent — safe to re-run if partially applied
-- =============================================================

-- ============ 004: Messaging infrastructure ============

DO $$ BEGIN CREATE TYPE message_direction AS ENUM ('inbound', 'outbound'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE intent_source AS ENUM ('regex', 'ai', 'manual'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE delivery_status_enum AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed', 'undelivered'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS message_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  channel message_channel NOT NULL DEFAULT 'whatsapp',
  external_thread_id TEXT,
  last_message_at TIMESTAMPTZ,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, patient_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_message_threads_tenant ON message_threads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_patient ON message_threads(patient_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_last_msg ON message_threads(tenant_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS message_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  thread_id UUID NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  direction message_direction NOT NULL,
  channel message_channel NOT NULL,
  body TEXT NOT NULL,
  from_number TEXT,
  to_number TEXT,
  external_sid TEXT,
  intent TEXT,
  intent_confidence REAL,
  intent_source intent_source,
  context_appointment_id UUID REFERENCES appointments(id),
  context_offer_id UUID REFERENCES waitlist_offers(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_events_thread ON message_events(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_message_events_tenant ON message_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_events_external ON message_events(external_sid);

CREATE TABLE IF NOT EXISTS delivery_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_event_id UUID NOT NULL REFERENCES message_events(id) ON DELETE CASCADE,
  status delivery_status_enum NOT NULL,
  error_code TEXT,
  error_message TEXT,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_statuses_event ON delivery_statuses(message_event_id);

ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_statuses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Tenant isolation" ON message_threads
    FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant isolation" ON message_events
    FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant isolation" ON delivery_statuses
    FOR ALL USING (
      message_event_id IN (
        SELECT id FROM message_events WHERE tenant_id IN (
          SELECT id FROM tenants WHERE auth_user_id = auth.uid()
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS message_threads_updated_at ON message_threads;
CREATE TRIGGER message_threads_updated_at
  BEFORE UPDATE ON message_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ 005: Appointment slots ============

DO $$ BEGIN CREATE TYPE slot_status AS ENUM ('available', 'booked', 'blocked', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS appointment_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  location_name TEXT,
  service_code TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status slot_status NOT NULL DEFAULT 'available',
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  block_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_slots_tenant ON appointment_slots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_slots_provider ON appointment_slots(tenant_id, provider_name, start_at);
CREATE INDEX IF NOT EXISTS idx_slots_status ON appointment_slots(tenant_id, status, start_at);
CREATE INDEX IF NOT EXISTS idx_slots_appointment ON appointment_slots(appointment_id);

ALTER TABLE appointment_slots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Tenant isolation" ON appointment_slots
    FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DROP TRIGGER IF EXISTS appointment_slots_updated_at ON appointment_slots;
CREATE TRIGGER appointment_slots_updated_at
  BEFORE UPDATE ON appointment_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ 006: Optimization engine ============

DO $$ BEGIN CREATE TYPE optimization_type AS ENUM ('gap_fill', 'proactive_reschedule', 'slot_swap', 'load_balance'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE decision_status AS ENUM ('proposed', 'approved', 'rejected', 'executed', 'expired'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS optimization_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type optimization_type NOT NULL,
  status decision_status NOT NULL DEFAULT 'proposed',
  description TEXT NOT NULL,
  reasoning TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  source_appointment_id UUID REFERENCES appointments(id),
  target_slot_id UUID REFERENCES appointment_slots(id),
  target_waitlist_entry_id UUID REFERENCES waitlist_entries(id),
  proposed_changes JSONB NOT NULL DEFAULT '{}',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_optimization_tenant ON optimization_decisions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_optimization_status ON optimization_decisions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_optimization_type ON optimization_decisions(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_optimization_expires ON optimization_decisions(expires_at) WHERE status = 'proposed';

ALTER TABLE optimization_decisions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Tenant isolation" ON optimization_decisions
    FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DROP TRIGGER IF EXISTS optimization_decisions_updated_at ON optimization_decisions;
CREATE TRIGGER optimization_decisions_updated_at
  BEFORE UPDATE ON optimization_decisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ 007: Business rules engine ============

CREATE TABLE IF NOT EXISTS rulesets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_id UUID NOT NULL REFERENCES rulesets(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  conditions JSONB NOT NULL DEFAULT '[]',
  actions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ruleset_id, version)
);

CREATE INDEX IF NOT EXISTS idx_rulesets_tenant ON rulesets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rulesets_entity ON rulesets(tenant_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_rulesets_active ON rulesets(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_rule_versions_ruleset ON rule_versions(ruleset_id);
CREATE INDEX IF NOT EXISTS idx_rule_versions_active ON rule_versions(ruleset_id, is_active) WHERE is_active = true;

ALTER TABLE rulesets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_versions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Tenant isolation" ON rulesets
    FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant isolation" ON rule_versions
    FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DROP TRIGGER IF EXISTS rulesets_updated_at ON rulesets;
CREATE TRIGGER rulesets_updated_at
  BEFORE UPDATE ON rulesets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ 008: Audit event log ============

DO $$ BEGIN CREATE TYPE actor_type AS ENUM ('user', 'system', 'ai', 'cron', 'webhook'); EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_type actor_type NOT NULL,
  actor_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events(tenant_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events(tenant_id, actor_type);

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Tenant read only" ON audit_events
    FOR SELECT USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "No updates" ON audit_events
    FOR UPDATE USING (false);
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "No deletes" ON audit_events
    FOR DELETE USING (false);
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============ 009: Workflows, proposals, KPI, failed jobs ============

CREATE TABLE IF NOT EXISTS confirmation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'pending_send',
  message_event_id UUID REFERENCES message_events(id),
  deadline_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (appointment_id)
);

CREATE INDEX IF NOT EXISTS idx_confirmation_tenant ON confirmation_workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_confirmation_state ON confirmation_workflows(state, deadline_at)
  WHERE state IN ('pending_send', 'message_sent');
CREATE INDEX IF NOT EXISTS idx_confirmation_appointment ON confirmation_workflows(appointment_id);

CREATE TABLE IF NOT EXISTS slot_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  thread_id UUID REFERENCES message_threads(id),
  proposed_slots JSONB NOT NULL DEFAULT '[]',
  selected_index INTEGER,
  selected_slot_id UUID REFERENCES appointment_slots(id),
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposals_tenant ON slot_proposals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON slot_proposals(status, expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_proposals_patient ON slot_proposals(patient_id);

CREATE TABLE IF NOT EXISTS kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  period TEXT NOT NULL DEFAULT 'daily',
  metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, snapshot_date, period)
);

CREATE INDEX IF NOT EXISTS idx_kpi_tenant ON kpi_snapshots(tenant_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_period ON kpi_snapshots(tenant_id, period, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS failed_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  job_payload JSONB DEFAULT '{}',
  error_message TEXT NOT NULL,
  error_stack TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_failed_jobs_pending ON failed_jobs(job_type, next_retry_at)
  WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_failed_jobs_tenant ON failed_jobs(tenant_id) WHERE tenant_id IS NOT NULL;

ALTER TABLE confirmation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Tenant isolation" ON confirmation_workflows
    FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant isolation" ON slot_proposals
    FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant isolation" ON kpi_snapshots
    FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "Tenant isolation" ON failed_jobs
    FOR ALL USING (
      tenant_id IS NULL OR
      tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DROP TRIGGER IF EXISTS confirmation_workflows_updated_at ON confirmation_workflows;
CREATE TRIGGER confirmation_workflows_updated_at
  BEFORE UPDATE ON confirmation_workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS slot_proposals_updated_at ON slot_proposals;
CREATE TRIGGER slot_proposals_updated_at
  BEFORE UPDATE ON slot_proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============ 010: Booking sessions ============

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

CREATE INDEX IF NOT EXISTS idx_booking_sessions_active
  ON booking_sessions (phone, state)
  WHERE state NOT IN ('completed', 'expired', 'abandoned');

CREATE INDEX IF NOT EXISTS idx_booking_sessions_tenant
  ON booking_sessions (tenant_id);

CREATE INDEX IF NOT EXISTS idx_booking_sessions_expires
  ON booking_sessions (expires_at)
  WHERE state NOT IN ('completed', 'expired', 'abandoned');

ALTER TABLE booking_sessions ENABLE ROW LEVEL SECURITY;

-- Fix RLS: use auth.uid() pattern instead of current_setting('app.tenant_id')
DROP POLICY IF EXISTS booking_sessions_tenant_isolation ON booking_sessions;
DO $$ BEGIN
  CREATE POLICY "Tenant isolation" ON booking_sessions
    FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS tenant_phone_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_phone_numbers_lookup
  ON tenant_phone_numbers (phone_number)
  WHERE is_active = true;

ALTER TABLE tenant_phone_numbers ENABLE ROW LEVEL SECURITY;

-- Fix RLS: use auth.uid() pattern instead of current_setting('app.tenant_id')
DROP POLICY IF EXISTS tenant_phone_numbers_tenant_isolation ON tenant_phone_numbers;
DO $$ BEGIN
  CREATE POLICY "Tenant isolation" ON tenant_phone_numbers
    FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============ 011: Calendar integrations ============

CREATE TABLE IF NOT EXISTS calendar_integrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL CHECK (provider IN ('google', 'outlook', 'ical', 'csv')),
  label         TEXT,
  access_token_enc  TEXT,
  refresh_token_enc TEXT,
  token_expires_at  TIMESTAMPTZ,
  ical_url      TEXT,
  calendar_ids  JSONB DEFAULT '[]'::jsonb,
  last_sync_at  TIMESTAMPTZ,
  sync_token    TEXT,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked', 'error')),
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_tenant_provider UNIQUE (tenant_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_cal_integrations_tenant ON calendar_integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cal_integrations_status ON calendar_integrations(status) WHERE status = 'active';

ALTER TABLE calendar_integrations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "tenant_isolation_cal_integrations" ON calendar_integrations
    USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "tenant_insert_cal_integrations" ON calendar_integrations
    FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE OR REPLACE FUNCTION update_cal_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cal_integrations_updated_at ON calendar_integrations;
CREATE TRIGGER trg_cal_integrations_updated_at
  BEFORE UPDATE ON calendar_integrations
  FOR EACH ROW EXECUTE FUNCTION update_cal_integrations_updated_at();

CREATE TABLE IF NOT EXISTS import_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id  UUID REFERENCES calendar_integrations(id) ON DELETE SET NULL,
  provider        TEXT NOT NULL CHECK (provider IN ('google', 'outlook', 'ical', 'csv')),
  status          TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  total_events    INTEGER NOT NULL DEFAULT 0,
  imported        INTEGER NOT NULL DEFAULT 0,
  skipped         INTEGER NOT NULL DEFAULT 0,
  failed          INTEGER NOT NULL DEFAULT 0,
  error_details   JSONB DEFAULT '[]'::jsonb,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_import_logs_tenant ON import_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_integration ON import_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_import_logs_started ON import_logs(started_at DESC);

ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "tenant_isolation_import_logs" ON import_logs
    USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE POLICY "tenant_insert_import_logs" ON import_logs
    FOR INSERT WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============ Realtime Publication ============

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
    RAISE NOTICE 'OK: appointments added to supabase_realtime publication';
  ELSE
    RAISE NOTICE 'SKIP: appointments already in supabase_realtime publication';
  END IF;
END $$;

ALTER TABLE appointments REPLICA IDENTITY FULL;

-- ============ DONE ============
-- All migrations (004-011) + Realtime publication applied.
-- Expected: 16 new tables, all with RLS enabled.
-- Migration 010 RLS policies corrected to use auth.uid() pattern.
