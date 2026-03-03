---
phase: 01-infrastructure
plan: 01
status: complete
started: 2026-03-03T20:05:00Z
completed: 2026-03-03T20:15:00Z
duration_minutes: 10
---

# Plan 01-01 Summary: Migration Runner + Production Migrations

## What Was Built

Extended the existing `scripts/run-migrations.mjs` to cover all pending migrations (004-011), added PITR checkpoint with interactive confirmation, and configured Supabase Realtime publication on the appointments table. All migrations were then applied to production via Supabase Dashboard SQL Editor.

## Key Files

### Created
- `scripts/all-migrations-sql-editor.sql` — Fully idempotent combined SQL for Dashboard SQL Editor (fallback for direct connection issues)

### Modified
- `scripts/run-migrations.mjs` — Extended with PITR checkpoint, migrations 010-011, and Realtime publication setup

## Commits

| Commit | Description |
|--------|-------------|
| `9f3294f` | feat(01-01): extend migration runner with PITR checkpoint, migrations 010-011, and Realtime publication |

## Deviations

- **Connection string issue**: Direct PostgreSQL connection (`db.*.supabase.co`) did not resolve from the development machine, and the pooler returned "Tenant or user not found". Created `all-migrations-sql-editor.sql` as an idempotent combined script that the user pasted directly into the Supabase Dashboard SQL Editor instead.
- **RLS fix applied inline**: Migration 010's incorrect `current_setting('app.tenant_id')` RLS policies were corrected to `auth.uid()` pattern directly in the combined SQL script rather than as a separate step.

## Self-Check: PASSED

- [x] Migration runner extended with PITR checkpoint (readline confirmation)
- [x] MIGRATIONS array includes all 8 files (004-011)
- [x] Realtime publication setup with idempotent check
- [x] REPLICA IDENTITY FULL command present
- [x] All 16 tables created in production (via SQL Editor)
- [x] Migration 010 RLS policies corrected to auth.uid() pattern
- [x] Appointments table added to supabase_realtime publication
