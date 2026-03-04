-- Add per-tenant configurable appointment value for revenue calculations.
-- Default EUR 80.00 matches the existing value used in compute-snapshot.ts.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS avg_appointment_value NUMERIC(10,2) NOT NULL DEFAULT 80.00;
