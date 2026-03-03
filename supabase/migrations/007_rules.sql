-- Migration 007: Configurable business rules engine

CREATE TABLE rulesets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  entity_type TEXT NOT NULL, -- 'appointment', 'waitlist', 'offer', 'reminder', 'optimization'
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruleset_id UUID NOT NULL REFERENCES rulesets(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  conditions JSONB NOT NULL DEFAULT '[]', -- array of condition objects
  actions JSONB NOT NULL DEFAULT '[]', -- array of action objects
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT, -- user email
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ruleset_id, version)
);

CREATE INDEX idx_rulesets_tenant ON rulesets(tenant_id);
CREATE INDEX idx_rulesets_entity ON rulesets(tenant_id, entity_type);
CREATE INDEX idx_rulesets_active ON rulesets(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX idx_rule_versions_ruleset ON rule_versions(ruleset_id);
CREATE INDEX idx_rule_versions_active ON rule_versions(ruleset_id, is_active) WHERE is_active = true;

-- RLS
ALTER TABLE rulesets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rule_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON rulesets
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));

CREATE POLICY "Tenant isolation" ON rule_versions
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));

CREATE TRIGGER rulesets_updated_at
  BEFORE UPDATE ON rulesets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
