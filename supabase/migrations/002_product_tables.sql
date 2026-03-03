-- NowShow Product Tables — Core business entities
-- Run in Supabase SQL Editor after 001_initial_schema.sql

-- Enums
CREATE TYPE public.appointment_status AS ENUM (
  'scheduled', 'reminder_pending', 'reminder_sent', 'confirmed',
  'declined', 'timeout', 'completed', 'no_show', 'cancelled'
);

CREATE TYPE public.waitlist_status AS ENUM (
  'waiting', 'offer_pending', 'offer_accepted', 'offer_declined',
  'offer_timeout', 'fulfilled', 'expired', 'withdrawn'
);

CREATE TYPE public.clinical_urgency AS ENUM (
  'none', 'low', 'medium', 'high', 'critical'
);

CREATE TYPE public.message_channel AS ENUM (
  'whatsapp', 'sms', 'email'
);

-- Patients
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  external_id VARCHAR(255),
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  date_of_birth DATE,
  phone VARCHAR(50),
  email VARCHAR(255),
  preferred_channel public.message_channel NOT NULL DEFAULT 'email',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, external_id)
);

-- Appointments
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  service_code VARCHAR(100),
  service_name VARCHAR(255) NOT NULL,
  provider_name VARCHAR(255),
  location_name VARCHAR(255),
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 30,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  external_id VARCHAR(255),
  payment_category VARCHAR(50),
  notes TEXT,

  -- Risk scoring
  risk_score INTEGER,
  risk_reasoning TEXT,
  risk_scored_at TIMESTAMPTZ,

  -- Confirmation tracking
  confirmation_sent_at TIMESTAMPTZ,
  confirmation_deadline TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, external_id)
);

-- Reminders
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  channel public.message_channel NOT NULL DEFAULT 'email',
  message_tone VARCHAR(50) NOT NULL DEFAULT 'standard',
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Waitlist Entries
CREATE TABLE IF NOT EXISTS public.waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  service_code VARCHAR(100),
  service_name VARCHAR(255) NOT NULL,
  preferred_provider VARCHAR(255),
  location_name VARCHAR(255),
  preferred_time_slots JSONB DEFAULT '[]',
  flexible_time BOOLEAN NOT NULL DEFAULT true,
  clinical_urgency public.clinical_urgency NOT NULL DEFAULT 'none',
  distance_km REAL,
  payment_category VARCHAR(50),
  status public.waitlist_status NOT NULL DEFAULT 'waiting',
  priority_score INTEGER NOT NULL DEFAULT 0,
  priority_reason VARCHAR(100),
  smart_score INTEGER,
  smart_score_breakdown JSONB,
  valid_until TIMESTAMPTZ,
  max_offers INTEGER NOT NULL DEFAULT 3,
  offers_sent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_patients_tenant ON public.patients(tenant_id);
CREATE INDEX idx_patients_external ON public.patients(tenant_id, external_id);
CREATE INDEX idx_patients_name ON public.patients(tenant_id, last_name, first_name);

CREATE INDEX idx_appointments_tenant ON public.appointments(tenant_id);
CREATE INDEX idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX idx_appointments_status ON public.appointments(tenant_id, status);
CREATE INDEX idx_appointments_scheduled ON public.appointments(tenant_id, scheduled_at);
CREATE INDEX idx_appointments_external ON public.appointments(tenant_id, external_id);

CREATE INDEX idx_reminders_tenant ON public.reminders(tenant_id);
CREATE INDEX idx_reminders_appointment ON public.reminders(appointment_id);
CREATE INDEX idx_reminders_scheduled ON public.reminders(scheduled_at) WHERE status = 'pending';

CREATE INDEX idx_waitlist_tenant ON public.waitlist_entries(tenant_id);
CREATE INDEX idx_waitlist_status ON public.waitlist_entries(tenant_id, status);
CREATE INDEX idx_waitlist_patient ON public.waitlist_entries(patient_id);

-- RLS Policies: Patients
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for patients"
  ON public.patients FOR ALL
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
  );

-- RLS Policies: Appointments
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for appointments"
  ON public.appointments FOR ALL
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
  );

-- RLS Policies: Reminders
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for reminders"
  ON public.reminders FOR ALL
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
  );

-- RLS Policies: Waitlist Entries
ALTER TABLE public.waitlist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for waitlist"
  ON public.waitlist_entries FOR ALL
  USING (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
  );

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER waitlist_entries_updated_at
  BEFORE UPDATE ON public.waitlist_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
