-- Add sidebar_order column to tenants for custom sidebar link ordering
-- NULL = use default order; otherwise JSONB array of href strings e.g. ["/dashboard", "/calendar", ...]
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS sidebar_order JSONB DEFAULT NULL;
