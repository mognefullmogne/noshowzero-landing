# Phase 1: Infrastructure - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Synchronize production database with all 11 migrations, enable Supabase Realtime publication on the appointments table, verify RLS policies on all new tables, and confirm the WhatsApp webhook flow works end-to-end. No new features — strictly infrastructure readiness for Phase 2 (Core Realtime).

</domain>

<decisions>
## Implementation Decisions

### Migration delivery
- User provides DATABASE_URL connection string from Supabase Dashboard > Settings > Database > Connection string (URI tab)
- Extend existing `scripts/run-migrations.mjs` to cover all pending migrations: 004-009 (individual files), 010 (booking_sessions), 011 (integrations)
- Include `ALTER PUBLICATION supabase_realtime ADD TABLE appointments` at the end of the migration script
- Stop-on-failure behavior: if any migration fails, halt immediately and report which one failed with the error message. Already-applied migrations are skipped via "already exists" detection. Safe to re-run.

### Backup approach
- Use Supabase Point-in-Time Recovery (PITR) — zero effort, included in Pro plan
- Migration script prints PITR checkpoint timestamp at the start and waits for Enter key confirmation before proceeding
- No need for pg_dump or CSV export — production data is minimal (1 patient, 1 appointment)

### Publication scope
- Add only the `appointments` table to `supabase_realtime` publication in Phase 1
- Other tables (waitlist_entries, confirmation_workflows) deferred until those features need real-time updates
- Publish all change types: INSERT, UPDATE, DELETE
- Full row data in change events (not just primary key) — allows in-place dashboard updates without re-fetching
- Supabase Realtime `replica identity` must be set to FULL on the appointments table for full row data in change events

### Verification method
- Automated verification script (can be part of migration script or separate)
- Checks after migrations:
  1. All tables from migrations 004-011 exist in the database
  2. RLS is enabled on each new table with at least one SELECT policy
  3. Appointments table is in the `supabase_realtime` publication
  4. Existing data intact: stefano rossi patient record and "esame prostata" appointment still exist with correct status
- For any new table missing RLS policies: auto-create tenant-scoped policies matching existing pattern (`tenant_id = auth.uid()`)
- Pass/fail output for each check

### Claude's Discretion
- Exact migration script structure and error handling details
- RLS policy SQL syntax and naming conventions
- Verification script output formatting
- Whether to use a single script or separate migration + verification scripts
- Order of individual migration files (004 before 005 before 006, etc.)

</decisions>

<specifics>
## Specific Ideas

- The existing `scripts/run-migrations.mjs` already handles 004-009 with `pg` client and "already exists" skip logic — extend rather than rewrite
- `scripts/combined_migrations_004_009.sql` exists as a single SQL blob alternative but the individual file approach is preferred for better error reporting
- Previous session hit a DB password issue with Supabase pooler ("Tenant or user not found") — user will provide the correct connection string fresh from the dashboard

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/run-migrations.mjs`: Node.js migration runner using `pg` client with "already exists" skip logic — extend to cover 010-011
- `scripts/combined_migrations_004_009.sql`: Combined SQL for 004-009 (backup reference)
- `supabase/migrations/010_booking_sessions.sql`: Booking sessions table migration
- `supabase/migrations/011_integrations.sql`: Calendar integrations migration

### Established Patterns
- Migration files are plain SQL in `supabase/migrations/` directory, numbered sequentially
- Supabase client factory: `src/lib/supabase/client.ts` (browser) and `src/lib/supabase/server.ts` (server)
- Tenant scoping: `getAuthenticatedTenant()` returns tenant_id, used in every query
- RLS pattern: `tenant_id = auth.uid()` for row-level security on all tenant-scoped tables

### Integration Points
- After migrations: webhook flow (`src/app/api/webhooks/twilio/route.ts`) should work with newly created tables
- After Realtime publication: Phase 2 `useRealtimeAppointments` hook will subscribe to appointments table changes
- RLS policies must be compatible with both the Supabase anon key (client-side) and service_role key (server-side cron/webhooks)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-infrastructure*
*Context gathered: 2026-03-03*
