-- Migration 011: Calendar integrations & import logs
-- Supports Google Calendar, Outlook, iCal feeds, and CSV imports

-- ============================================================
-- Table: calendar_integrations
-- ============================================================
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

-- Indexes
CREATE INDEX idx_cal_integrations_tenant ON calendar_integrations(tenant_id);
CREATE INDEX idx_cal_integrations_status ON calendar_integrations(status) WHERE status = 'active';

-- RLS
ALTER TABLE calendar_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_cal_integrations" ON calendar_integrations
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "tenant_insert_cal_integrations" ON calendar_integrations
  FOR INSERT WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE auth_user_id = auth.uid()
  ));

-- Note: service_role key bypasses RLS by default in Supabase — no explicit policy needed.

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_cal_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cal_integrations_updated_at
  BEFORE UPDATE ON calendar_integrations
  FOR EACH ROW EXECUTE FUNCTION update_cal_integrations_updated_at();


-- ============================================================
-- Table: import_logs
-- ============================================================
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

-- Indexes
CREATE INDEX idx_import_logs_tenant ON import_logs(tenant_id);
CREATE INDEX idx_import_logs_integration ON import_logs(integration_id);
CREATE INDEX idx_import_logs_started ON import_logs(started_at DESC);

-- RLS
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_import_logs" ON import_logs
  USING (tenant_id IN (
    SELECT id FROM tenants WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "tenant_insert_import_logs" ON import_logs
  FOR INSERT WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE auth_user_id = auth.uid()
  ));

-- Note: service_role key bypasses RLS by default in Supabase — no explicit policy needed.
