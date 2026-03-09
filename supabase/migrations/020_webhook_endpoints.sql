-- Outbound webhook system: endpoints + delivery tracking
-- Migration: 020

-- Webhook endpoint registrations per tenant
create table if not exists webhook_endpoints (
  id            uuid        default gen_random_uuid() primary key,
  tenant_id     uuid        not null references tenants(id),
  url           text        not null,
  secret        text        not null,
  events        text[]      not null,
  is_active     boolean     default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Delivery log for each webhook dispatch attempt
create table if not exists webhook_deliveries (
  id                  uuid        default gen_random_uuid() primary key,
  tenant_id           uuid        not null,
  webhook_endpoint_id uuid        not null references webhook_endpoints(id),
  event_type          text        not null,
  payload             jsonb       not null,
  status              text        not null default 'pending',
  attempts            int         default 0,
  last_attempt_at     timestamptz,
  response_status     int,
  response_body       text,
  created_at          timestamptz default now()
);

-- RLS
alter table webhook_endpoints enable row level security;
alter table webhook_deliveries enable row level security;

create policy "webhook_endpoints_select" on webhook_endpoints
  for select using (tenant_id = auth.uid());

create policy "webhook_endpoints_insert" on webhook_endpoints
  for insert with check (tenant_id = auth.uid());

create policy "webhook_endpoints_update" on webhook_endpoints
  for update using (tenant_id = auth.uid());

create policy "webhook_deliveries_select" on webhook_deliveries
  for select using (tenant_id = auth.uid());

create policy "webhook_deliveries_insert" on webhook_deliveries
  for insert with check (tenant_id = auth.uid());

create policy "webhook_deliveries_update" on webhook_deliveries
  for update using (tenant_id = auth.uid());

-- Index for efficient delivery queries
create index if not exists idx_webhook_deliveries_endpoint_status
  on webhook_deliveries (webhook_endpoint_id, status);
