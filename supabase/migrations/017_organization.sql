-- Migration 017: Organization (services + operators)
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/hwxebnmrgrdzpfappyvk/sql

-- Servizi offerti dal tenant
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_min INTEGER NOT NULL DEFAULT 30,
  price NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'EUR',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Operators (staff/provider)
CREATE TABLE IF NOT EXISTS public.operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quali servizi può fare ogni operator
CREATE TABLE IF NOT EXISTS public.operator_services (
  operator_id UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  PRIMARY KEY (operator_id, service_id)
);

-- Aggiungi FK opzionali agli appuntamenti
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES public.operators(id) ON DELETE SET NULL;

-- Aggiungi service_id alle booking sessions per tracciare la scelta del bot
ALTER TABLE public.booking_sessions
  ADD COLUMN IF NOT EXISTS collected_service_id UUID REFERENCES public.services(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_services" ON public.services
  USING (tenant_id = (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid()));
CREATE POLICY "tenant_operators" ON public.operators
  USING (tenant_id = (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid()));
CREATE POLICY "tenant_operator_services" ON public.operator_services
  USING (tenant_id = (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid()));
