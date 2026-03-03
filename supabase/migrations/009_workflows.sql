-- Migration 009: Confirmation workflows, slot proposals, KPI snapshots, failed jobs

-- Confirmation workflow state machine
CREATE TABLE confirmation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'pending_send',
  -- States: pending_send → message_sent → confirmed | declined | timed_out | cancelled
  message_event_id UUID REFERENCES message_events(id),
  deadline_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (appointment_id)
);

CREATE INDEX idx_confirmation_tenant ON confirmation_workflows(tenant_id);
CREATE INDEX idx_confirmation_state ON confirmation_workflows(state, deadline_at)
  WHERE state IN ('pending_send', 'message_sent');
CREATE INDEX idx_confirmation_appointment ON confirmation_workflows(appointment_id);

-- Slot proposals (conversational reschedule via WhatsApp)
CREATE TABLE slot_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  thread_id UUID REFERENCES message_threads(id),
  proposed_slots JSONB NOT NULL DEFAULT '[]', -- array of {index, slot_id, start_at, end_at, provider_name}
  selected_index INTEGER, -- 1, 2, or 3
  selected_slot_id UUID REFERENCES appointment_slots(id),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, selected, expired, cancelled
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposals_tenant ON slot_proposals(tenant_id);
CREATE INDEX idx_proposals_status ON slot_proposals(status, expires_at) WHERE status = 'pending';
CREATE INDEX idx_proposals_patient ON slot_proposals(patient_id);

-- KPI snapshots (daily aggregated metrics)
CREATE TABLE kpi_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  period TEXT NOT NULL DEFAULT 'daily', -- daily, weekly, monthly
  metrics JSONB NOT NULL DEFAULT '{}',
  -- Expected keys: total_appointments, no_shows, cancellations, completions,
  -- confirmation_rate, avg_risk_score, offers_sent, offers_accepted,
  -- backfill_rate, avg_response_minutes, revenue_saved, optimization_actions
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, snapshot_date, period)
);

CREATE INDEX idx_kpi_tenant ON kpi_snapshots(tenant_id, snapshot_date DESC);
CREATE INDEX idx_kpi_period ON kpi_snapshots(tenant_id, period, snapshot_date DESC);

-- Failed jobs (observability for serverless cron failures)
CREATE TABLE failed_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL, -- 'send_confirmation', 'check_timeout', 'run_optimization', etc.
  job_payload JSONB DEFAULT '{}',
  error_message TEXT NOT NULL,
  error_stack TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_failed_jobs_pending ON failed_jobs(job_type, next_retry_at)
  WHERE resolved_at IS NULL;
CREATE INDEX idx_failed_jobs_tenant ON failed_jobs(tenant_id) WHERE tenant_id IS NOT NULL;

-- RLS
ALTER TABLE confirmation_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE failed_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON confirmation_workflows
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));

CREATE POLICY "Tenant isolation" ON slot_proposals
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));

CREATE POLICY "Tenant isolation" ON kpi_snapshots
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));

CREATE POLICY "Tenant isolation" ON failed_jobs
  FOR ALL USING (
    tenant_id IS NULL OR
    tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())
  );

CREATE TRIGGER confirmation_workflows_updated_at
  BEFORE UPDATE ON confirmation_workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER slot_proposals_updated_at
  BEFORE UPDATE ON slot_proposals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
