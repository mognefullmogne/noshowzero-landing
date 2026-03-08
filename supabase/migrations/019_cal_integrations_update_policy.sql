-- Migration 019: Add missing RLS UPDATE policy for calendar_integrations
-- Without this, authenticated users cannot update their own integrations (e.g. token refresh)

CREATE POLICY "tenant_update_cal_integrations" ON calendar_integrations
  FOR UPDATE USING (tenant_id IN (
    SELECT id FROM tenants WHERE auth_user_id = auth.uid()
  )) WITH CHECK (tenant_id IN (
    SELECT id FROM tenants WHERE auth_user_id = auth.uid()
  ));
