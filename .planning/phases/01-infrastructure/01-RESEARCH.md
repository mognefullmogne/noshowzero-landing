# Phase 1: Infrastructure - Research

**Researched:** 2026-03-03
**Domain:** Supabase PostgreSQL migrations, Realtime publication, RLS policies
**Confidence:** HIGH

## Summary

Phase 1 is a pure database operations phase: apply pending SQL migrations (004-011) to the production Supabase database, add the `appointments` table to the `supabase_realtime` publication with `REPLICA IDENTITY FULL`, and verify that all new tables have proper RLS policies. No application code changes are needed -- only the migration runner script (`scripts/run-migrations.mjs`) needs to be extended to cover migrations 010-011 and add the publication/replica identity commands.

The existing migration runner uses a simple but effective pattern: execute each SQL file via the `pg` client, and if it throws an "already exists" error, skip it. This works because migrations 004-009 use bare `CREATE TYPE`/`CREATE TABLE` (no `IF NOT EXISTS`), so re-running them on an already-migrated database triggers a caught error. Migrations 010-011 use `CREATE TABLE IF NOT EXISTS` for tables, making them natively idempotent at the table level.

**Primary recommendation:** Extend `run-migrations.mjs` to include 010 and 011, append the Realtime publication and replica identity SQL, add a verification step that checks all tables exist with RLS enabled, and fix the RLS policy inconsistency in migration 010 before applying.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- User provides DATABASE_URL connection string from Supabase Dashboard > Settings > Database > Connection string (URI tab)
- Extend existing `scripts/run-migrations.mjs` to cover all pending migrations: 004-009 (individual files), 010 (booking_sessions), 011 (integrations)
- Include `ALTER PUBLICATION supabase_realtime ADD TABLE appointments` at the end of the migration script
- Stop-on-failure behavior: if any migration fails, halt immediately and report which one failed with the error message. Already-applied migrations are skipped via "already exists" detection. Safe to re-run.
- Use Supabase Point-in-Time Recovery (PITR) -- zero effort, included in Pro plan
- Migration script prints PITR checkpoint timestamp at the start and waits for Enter key confirmation before proceeding
- No need for pg_dump or CSV export -- production data is minimal (1 patient, 1 appointment)
- Add only the `appointments` table to `supabase_realtime` publication in Phase 1
- Publish all change types: INSERT, UPDATE, DELETE
- Full row data in change events (not just primary key) -- allows in-place dashboard updates without re-fetching
- Supabase Realtime `replica identity` must be set to FULL on the appointments table for full row data in change events
- Automated verification script checks: all tables exist, RLS enabled with at least one SELECT policy, appointments in publication, existing data intact
- For any new table missing RLS policies: auto-create tenant-scoped policies matching existing pattern (`tenant_id = auth.uid()`)

### Claude's Discretion
- Exact migration script structure and error handling details
- RLS policy SQL syntax and naming conventions
- Verification script output formatting
- Whether to use a single script or separate migration + verification scripts
- Order of individual migration files (004 before 005 before 006, etc.)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Production database is backed up before any migration runs (PITR or manual pg_dump) | PITR approach confirmed -- script prints timestamp checkpoint and waits for Enter key. No pg_dump needed per user decision. |
| INFRA-02 | All pending migrations (004-011) are applied to production Supabase without data loss | Migration runner extension pattern documented; idempotency analysis complete; RLS inconsistency in 010 identified and fix documented. No destructive SQL found in any migration. |
| INFRA-03 | Appointments table is added to the `supabase_realtime` publication | Two SQL commands needed: `ALTER PUBLICATION supabase_realtime ADD TABLE appointments` and `ALTER TABLE appointments REPLICA IDENTITY FULL`. Exact syntax verified against Supabase docs. |
| INFRA-04 | All new tables from migrations 004-011 have RLS enabled with correct SELECT policies | All migrations 004-011 include RLS enablement. Policy patterns verified. Migration 010 uses incompatible `current_setting('app.tenant_id')` pattern -- must be fixed to match `auth.uid()` pattern. |
| INFRA-05 | Webhook flow (Twilio -> appointment status update) works reliably with all tables present | Webhook route (`src/app/api/webhooks/twilio/route.ts`) uses `createServiceClient()` (service_role key, bypasses RLS). References tables from 004 (message_threads, message_events) and 010 (booking_sessions, tenant_phone_numbers). All must exist for webhook to function. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pg | ^8.19.0 | PostgreSQL client for Node.js | Already in devDependencies; used by existing `run-migrations.mjs` |
| @supabase/supabase-js | ^2.98.0 | Supabase client (for verification queries) | Already in dependencies; provides typed query builder |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| readline (Node built-in) | N/A | Prompt user for Enter key confirmation | PITR checkpoint confirmation before migration execution |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom migration runner | Supabase CLI `supabase db push` | CLI requires local Supabase setup and project linking; custom runner is simpler for this one-time operation |
| pg client | Supabase SQL Editor (dashboard) | Dashboard is manual and error-prone for 8+ migrations; script is auditable and repeatable |

**Installation:**
No new packages needed. `pg` is already in devDependencies, `readline` is a Node.js built-in.

## Architecture Patterns

### Recommended Script Structure
```
scripts/
  run-migrations.mjs          # Extended: 004-011 + publication + replica identity
  verify-infrastructure.mjs   # NEW: Post-migration verification checks
```

### Pattern 1: Sequential Migration with Catch-and-Skip
**What:** Execute each migration SQL file in order. If it throws an error containing "already exists", treat as skipped. Any other error halts execution.
**When to use:** When running SQL files that lack `IF NOT EXISTS` clauses (migrations 004-009).
**Example:**
```javascript
// Source: existing scripts/run-migrations.mjs
for (const migration of MIGRATIONS) {
  const sql = readFileSync(join(ROOT, 'supabase', 'migrations', migration), 'utf-8');
  try {
    await client.query(sql);
    console.log(`  OK ${migration} applied`);
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log(`  SKIP ${migration} -- already applied`);
    } else {
      console.error(`  FAIL ${migration}: ${err.message}`);
      throw err; // halt immediately
    }
  }
}
```

### Pattern 2: PITR Checkpoint with Interactive Confirmation
**What:** Print a UTC timestamp before any migration runs. Prompt the user to confirm they have noted the timestamp (for PITR recovery if needed). Only proceed after Enter key press.
**When to use:** Before any production database modification.
**Example:**
```javascript
import { createInterface } from 'readline';

const checkpoint = new Date().toISOString();
console.log(`\nPITR Recovery Checkpoint: ${checkpoint}`);
console.log('Note this timestamp. If anything goes wrong, restore to this point in Supabase Dashboard > Database > Backups.');
console.log('\nPress Enter to continue or Ctrl+C to abort...');

await new Promise((resolve) => {
  const rl = createInterface({ input: process.stdin });
  rl.once('line', () => { rl.close(); resolve(); });
});
```

### Pattern 3: Realtime Publication Setup
**What:** Add the appointments table to the `supabase_realtime` publication and set replica identity to FULL.
**When to use:** After all migrations are applied, as the final step of the migration script.
**Example:**
```sql
-- Source: https://supabase.com/docs/guides/realtime/postgres-changes
ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
ALTER TABLE appointments REPLICA IDENTITY FULL;
```

### Pattern 4: Verification Queries
**What:** Query PostgreSQL system catalogs to verify tables exist, RLS is enabled, policies are present, and publication includes the right tables.
**When to use:** After migration completion, as a separate verification step.
**Example:**
```javascript
// Check if table exists
const { rows: tables } = await client.query(`
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public' AND tablename = $1
`, [tableName]);

// Check if RLS is enabled
const { rows: rlsCheck } = await client.query(`
  SELECT relrowsecurity FROM pg_class
  WHERE relname = $1 AND relnamespace = 'public'::regnamespace
`, [tableName]);

// Check if table has policies
const { rows: policies } = await client.query(`
  SELECT policyname, cmd FROM pg_policies
  WHERE schemaname = 'public' AND tablename = $1
`, [tableName]);

// Check publication membership
const { rows: pubTables } = await client.query(`
  SELECT tablename FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime' AND tablename = $1
`, [tableName]);

// Check replica identity
const { rows: replicaId } = await client.query(`
  SELECT relreplident FROM pg_class
  WHERE relname = $1 AND relnamespace = 'public'::regnamespace
`, [tableName]);
// relreplident: 'd' = default (PK only), 'f' = full, 'n' = nothing
```

### Anti-Patterns to Avoid
- **Running migrations in a single transaction:** PostgreSQL DDL is transactional, but if one migration in a batch fails, the entire transaction rolls back -- including successfully applied earlier migrations. The current per-file approach with catch-and-skip is safer.
- **Using the Supabase pooler connection string:** Pooler connections can cause "Tenant or user not found" errors. Always use the direct connection string (port 5432, `db.*.supabase.co` hostname).
- **Assuming `CREATE TYPE IF NOT EXISTS` works:** PostgreSQL does NOT support `IF NOT EXISTS` for `CREATE TYPE ... AS ENUM`. Migrations 004-009 correctly rely on the script-level "already exists" catch for idempotency.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Backup before migration | Custom pg_dump script | Supabase PITR (built-in) | PITR is automatic on Pro plan; zero code needed; user confirmed this approach |
| Migration state tracking | Custom migration version table | "already exists" error detection | The existing pattern works; no need for a `schema_migrations` table for 11 one-time migrations |
| RLS policy generation | Custom policy generator | Hardcoded SQL matching existing pattern | Only 2 tables (booking_sessions, tenant_phone_numbers) need policy fixes; a generator is overkill |
| Publication management | Custom publication tracker | Single SQL `ALTER PUBLICATION` | One table, one command; Supabase handles the rest |

**Key insight:** This phase is a one-time infrastructure setup, not a reusable framework. Keep scripts simple and specific rather than building abstractions.

## Common Pitfalls

### Pitfall 1: RLS Policy Pattern Mismatch in Migration 010
**What goes wrong:** Migration 010 (booking_sessions, tenant_phone_numbers) uses `current_setting('app.tenant_id', true)::uuid` for RLS instead of the project-wide pattern `tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid())`. This means queries from the Supabase client (which sets `auth.uid()` automatically via JWT) will return zero rows for those tables, because `app.tenant_id` is never set by the Supabase client.
**Why it happens:** Migration 010 was likely written for a different auth pattern (e.g., `SET app.tenant_id = ...` before each query) that the rest of the codebase does not use.
**How to avoid:** Before applying migration 010, replace the RLS policies with the standard `auth.uid()` pattern. Either modify the SQL file directly or add corrective `DROP POLICY` + `CREATE POLICY` SQL after migration 010 is applied.
**Warning signs:** After migration, queries to `booking_sessions` or `tenant_phone_numbers` return empty results for authenticated users, or the webhook route fails when trying to read/write these tables (service_role bypasses RLS so webhooks still work, but dashboard queries would fail).
**Corrective SQL:**
```sql
-- Fix booking_sessions RLS
DROP POLICY IF EXISTS booking_sessions_tenant_isolation ON booking_sessions;
CREATE POLICY "Tenant isolation" ON booking_sessions
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));

-- Fix tenant_phone_numbers RLS
DROP POLICY IF EXISTS tenant_phone_numbers_tenant_isolation ON tenant_phone_numbers;
CREATE POLICY "Tenant isolation" ON tenant_phone_numbers
  FOR ALL USING (tenant_id IN (SELECT id FROM tenants WHERE auth_user_id = auth.uid()));
```

### Pitfall 2: Connection String Format
**What goes wrong:** Using the Supabase pooler connection string (`*.pooler.supabase.co`) instead of the direct connection string (`db.*.supabase.co`) causes "Tenant or user not found" errors.
**Why it happens:** The pooler (Supavisor) requires a different username format (`postgres.{project-ref}`) and may route to the wrong server.
**How to avoid:** The script documentation and prompts must clearly state: use the **direct** connection string from Dashboard > Settings > Database > Connection string > URI tab. Direct connection uses port 5432 and hostname `db.{project-ref}.supabase.co`.
**Warning signs:** Error message containing "Tenant or user not found" or "FATAL: password authentication failed".

### Pitfall 3: Already-Applied Partial Migrations
**What goes wrong:** If a migration partially applied (e.g., tables created but RLS policies failed), re-running the script skips it because the first `CREATE TABLE` throws "already exists", but the RLS policies may still be missing.
**Why it happens:** The catch-and-skip logic treats the entire migration as "already applied" when the first statement fails, but the migration file contains multiple statements (CREATE TABLE + CREATE INDEX + ALTER TABLE + CREATE POLICY) and the `pg` client executes them as a batch.
**How to avoid:** The verification script must independently check each table for both existence AND RLS enablement AND policies. If a table exists but lacks policies, the verification script should auto-create them.
**Warning signs:** Verification script reports "Table X exists but has no RLS policies."

### Pitfall 4: Publication ADD TABLE on Already-Published Table
**What goes wrong:** Running `ALTER PUBLICATION supabase_realtime ADD TABLE appointments` when the table is already in the publication throws an error: `ERROR: relation "appointments" is already member of publication "supabase_realtime"`.
**Why it happens:** Script is re-run after a successful first execution.
**How to avoid:** Wrap in a conditional check or catch the specific error:
```sql
-- Check before adding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'appointments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE appointments;
  END IF;
END $$;
```
Or catch the error in the Node.js script the same way as "already exists".

### Pitfall 5: Replica Identity FULL Performance Impact
**What goes wrong:** Setting `REPLICA IDENTITY FULL` on a high-write table increases WAL (Write-Ahead Log) size because PostgreSQL must log the old version of every column for every UPDATE and DELETE.
**Why it happens:** FULL replica identity captures all columns instead of just the primary key.
**How to avoid:** For the `appointments` table with minimal production data (1 appointment currently) and low write volume, this is a non-issue. Only enable FULL on tables that actually need it for Realtime subscriptions. In Phase 1, only `appointments` needs FULL.
**Warning signs:** WAL disk usage spikes; replication lag increases. Monitor only if write volume grows significantly.

### Pitfall 6: Missing INSERT Policy for Service Role Operations
**What goes wrong:** Tables from migrations 004-009 use `FOR ALL` policies, which cover INSERT, UPDATE, DELETE, and SELECT. But the `audit_events` table (migration 008) has only a `FOR SELECT` policy and explicit deny policies for UPDATE and DELETE -- it has NO INSERT policy for regular users.
**Why it happens:** The audit_events table is designed to be insert-only via service_role (which bypasses RLS), and read-only for tenant users.
**How to avoid:** This is actually correct design -- audit events should only be inserted by server-side code (webhooks, cron jobs) using service_role, and read by users via the dashboard. The verification script should recognize this as valid: RLS enabled + at least one SELECT policy = pass.
**Warning signs:** None -- this is intentional. The verification script must not flag this as an error.

## Code Examples

Verified patterns from the existing codebase and official sources:

### Complete Table Inventory (migrations 004-011)
```
Migration 004 (messaging):
  - message_threads
  - message_events
  - delivery_statuses

Migration 005 (appointment_slots):
  - appointment_slots

Migration 006 (optimization):
  - optimization_decisions

Migration 007 (rules):
  - rulesets
  - rule_versions

Migration 008 (audit):
  - audit_events

Migration 009 (workflows):
  - confirmation_workflows
  - slot_proposals
  - kpi_snapshots
  - failed_jobs

Migration 010 (booking_sessions):
  - booking_sessions
  - tenant_phone_numbers

Migration 011 (integrations):
  - calendar_integrations
  - import_logs
```

Total: 16 new tables across 8 migrations.

### Existing Data Integrity Check
```javascript
// Source: CONTEXT.md -- verify existing patient and appointment survive migration
const { data: patient } = await supabase
  .from('patients')
  .select('id, first_name, last_name')
  .ilike('last_name', '%rossi%')
  .maybeSingle();

const { data: appointment } = await supabase
  .from('appointments')
  .select('id, service_name, status')
  .ilike('service_name', '%prostata%')
  .maybeSingle();

// Both must exist and have correct data after migrations
```

### RLS Policy Naming Convention (from existing migrations)
```sql
-- Migrations 001-003: Descriptive names
CREATE POLICY "Tenant isolation for patients" ON patients FOR ALL USING (...);
CREATE POLICY "Users can view own tenant" ON tenants FOR SELECT USING (...);

-- Migrations 004-009: Simple "Tenant isolation" name
CREATE POLICY "Tenant isolation" ON message_threads FOR ALL USING (...);

-- Migration 011: Underscore-separated names
CREATE POLICY "tenant_isolation_cal_integrations" ON calendar_integrations USING (...);
```
Recommendation: Use "Tenant isolation" (the dominant pattern from 004-009) for any auto-generated policies.

### Enum Types Created by Migrations 004-009
```sql
-- These CREATE TYPE statements will throw "already exists" if re-run (no IF NOT EXISTS support)
-- Migration 004:
message_direction, intent_source, delivery_status_enum
-- Migration 005:
slot_status
-- Migration 006:
optimization_type, decision_status
-- Migration 008:
actor_type
-- Migration 003 (already applied):
offer_status
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual SQL Editor execution | Script-based migration runner | Current project | Repeatable, auditable migration process |
| pg_dump for backups | Supabase PITR (Point-in-Time Recovery) | Supabase Pro plan | Zero-effort backup with minute-level granularity |
| Polling for real-time updates | Supabase Realtime (postgres_changes) | Current project (Phase 2) | Phase 1 prepares the publication for this transition |

**Deprecated/outdated:**
- Supabase key naming migration (sb_publishable_*, sb_secret_*) had a Nov 2025 deadline. Current env vars still use `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Verify in Dashboard that these keys still work. This is a Phase 2 concern noted in STATE.md blockers.

## Open Questions

1. **Which migrations are already applied in production?**
   - What we know: Migrations 001-003 are almost certainly applied (the app is live with patients and appointments). Migrations 004-011 are "pending" per the project context.
   - What's unclear: Whether any of 004-009 were partially applied during previous attempts (the STATE.md mentions a "DB password issue" in a previous session).
   - Recommendation: The "already exists" skip logic handles this gracefully. The verification script will confirm final state regardless of starting state.

2. **Does the `supabase_realtime` publication already exist?**
   - What we know: Supabase automatically creates this publication on all projects. It is always present but may be empty (no tables added).
   - What's unclear: Whether any tables are already added to it.
   - Recommendation: Use `ADD TABLE` with error handling for "already member" case. The verification step confirms final state.

3. **Service role key behavior with Realtime subscriptions**
   - What we know: The service_role key bypasses RLS for direct queries. Realtime broadcasts respect individual client RLS policies regardless of how the data was written.
   - What's unclear: Confirmed that webhook writes (via service_role) will trigger Realtime events that are then filtered by each subscriber's RLS policies.
   - Recommendation: This is correct behavior and is what we want. Webhook writes trigger changes; dashboard subscribers only see their tenant's changes. No action needed in Phase 1.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None -- no test framework is configured in this project |
| Config file | None |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | PITR checkpoint printed before migration | manual-only | Visual confirmation of timestamp in script output | N/A |
| INFRA-02 | All 16 tables from migrations 004-011 exist | smoke | `node scripts/verify-infrastructure.mjs` | Wave 0 |
| INFRA-03 | appointments table in supabase_realtime publication | smoke | `node scripts/verify-infrastructure.mjs` | Wave 0 |
| INFRA-04 | All new tables have RLS enabled with SELECT policies | smoke | `node scripts/verify-infrastructure.mjs` | Wave 0 |
| INFRA-05 | Webhook flow updates appointment status | manual-only | Twilio webhook simulator or ngrok test -- requires live Twilio credentials and running deployment | N/A |

**Manual-only justification:**
- INFRA-01: PITR is a Supabase platform feature; verification is confirming the timestamp was printed (visual in terminal).
- INFRA-05: Requires an end-to-end Twilio webhook call to a live deployment; cannot be automated in a local script without a full integration test environment.

### Sampling Rate
- **Per task commit:** `node scripts/verify-infrastructure.mjs` (post-migration verification)
- **Per wave merge:** Same verification script
- **Phase gate:** All verification checks pass + manual webhook test

### Wave 0 Gaps
- [ ] `scripts/verify-infrastructure.mjs` -- covers INFRA-02, INFRA-03, INFRA-04
- [ ] No test framework needed -- this phase uses a verification script against the live database, not unit tests

## Sources

### Primary (HIGH confidence)
- [Supabase Realtime Postgres Changes docs](https://supabase.com/docs/guides/realtime/postgres-changes) -- publication setup, replica identity, subscription syntax
- [PostgreSQL Publication docs](https://www.postgresql.org/docs/current/logical-replication-publication.html) -- ALTER PUBLICATION syntax, replica identity behavior
- Existing codebase: `scripts/run-migrations.mjs`, `supabase/migrations/001-011`, `src/app/api/webhooks/twilio/route.ts`, `src/lib/supabase/server.ts`

### Secondary (MEDIUM confidence)
- [Supabase connection troubleshooting](https://github.com/orgs/supabase/discussions/35749) -- pooler vs direct connection issues
- [Supabase RLS with Realtime](https://supabase.com/blog/realtime-row-level-security-in-postgresql) -- how RLS policies filter Realtime broadcasts

### Tertiary (LOW confidence)
- None -- all findings verified against official docs or existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- existing `pg` client and migration pattern are well-understood and verified in codebase
- Architecture: HIGH -- extending an existing working script; no new architectural decisions needed
- Pitfalls: HIGH -- RLS inconsistency identified by direct code review; connection string issue documented in STATE.md; `CREATE TYPE` idempotency verified against PostgreSQL docs

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable infrastructure -- Supabase Realtime API is mature)
