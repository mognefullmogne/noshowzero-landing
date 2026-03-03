# Domain Pitfalls

**Domain:** Real-time appointment management dashboard — adding Supabase Realtime to existing Next.js App Router app on Vercel, with 8 pending production DB migrations
**Project:** NoShowZero — noshowzero-landing
**Researched:** 2026-03-03
**Confidence:** HIGH (Supabase official docs + community patterns) / MEDIUM (platform edge cases)

---

## Critical Pitfalls

Mistakes that cause security breaches, data loss, or full rewrites.

---

### Pitfall 1: Running Migrations Without Backup — Permanent Data Loss

**What goes wrong:**
Migrations 004–011 are applied directly to the live production Supabase database (which holds real patient data — "stefano rossi", appointment "esame prostata 06/03/2026"). A migration that contains a destructive `DROP TABLE`, `TRUNCATE`, or incorrect `ALTER TABLE ... SET DEFAULT` wipes real patient data with no recovery path.

**Why it happens:**
Developers test migrations locally where seed data is disposable. They then apply the same file to production without a backup, assuming the schema-only changes are safe. Supabase down-migrations are typically destructive SQL statements by design.

**Consequences:**
- Permanent loss of production patient data
- Broken appointment records — FK orphans if parent rows are deleted
- No rollback option unless a Point-in-Time Recovery (PITR) backup exists

**Prevention:**
1. Enable Supabase PITR (Point-in-Time Recovery) in Dashboard > Project Settings > Backups before running any migration. Free tier does NOT include PITR — upgrade to Pro first if needed.
2. Export a manual pg_dump before migrating: `pg_dump [connection_string] > backup_$(date +%Y%m%d).sql`
3. Run each migration SQL against a staging branch (Supabase branching, if available) first.
4. Review every migration file for `DROP`, `TRUNCATE`, `DELETE`, `ALTER COLUMN TYPE` before applying.
5. Migrations should always roll forward — never reset a production migration.

**Detection (warning signs):**
- Any migration file containing `DROP TABLE` or `TRUNCATE`
- A migration that alters a column type (e.g., `varchar` to `uuid`) on a table with existing data
- No backup confirmation step before `supabase db push` or direct psql execution

**Phase that should address this:** Migration phase (immediately before running any migration SQL in production)

---

### Pitfall 2: Exposing `service_role` / `secret` Key Client-Side

**What goes wrong:**
The Supabase `service_role` key (or its new equivalent `sb_secret_...`) is embedded in a client-side Next.js component, bundled into the browser JS, and becomes publicly visible in DevTools. This key bypasses ALL Row Level Security.

**Why it happens:**
Developers grab the wrong key from the Supabase Dashboard. The `service_role` key is listed next to the `anon`/`publishable` key and is accidentally pasted into `NEXT_PUBLIC_*` environment variables, which are inlined into the browser bundle.

**Consequences:**
- Full unrestricted read/write/delete access to the entire database
- Any user can read all tenants' patient records — catastrophic for a multi-tenant medical SaaS
- Supabase (as of late 2025) is migrating to new key naming (`sb_publishable_*` / `sb_secret_*`) — old projects must audit before November 1, 2025 migration deadline

**Prevention:**
1. Only `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `sb_publishable_*`) goes in client-side env vars.
2. `service_role` / `sb_secret_*` must ONLY appear in server-side env vars (no `NEXT_PUBLIC_` prefix).
3. Add a CI check or pre-commit hook: `grep -r "service_role" src/` should return zero matches.
4. For Realtime client-side subscriptions, always use the anon/publishable key — Realtime respects RLS when using this key.
5. Check `NEXT_PUBLIC_` variables in `.env.local`, `.env.production`, and Vercel Dashboard environment variables.

**Detection (warning signs):**
- `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` present in any env file
- `service_role` key appearing in browser network requests or bundle analysis
- Real-time subscriptions that return all rows for all tenants (no filtering)

**Phase that should address this:** Security review before any Realtime implementation

---

### Pitfall 3: RLS Blocks Realtime Without Any Error Message

**What goes wrong:**
A table is added to the `supabase_realtime` publication and a client subscribes — but the subscription silently receives zero events. No error is thrown. The table has RLS enabled but no `SELECT` policy for authenticated users (or the policy is too restrictive).

**Why it happens:**
Realtime's Postgres Changes feature evaluates RLS policies before broadcasting change events. If the authenticated user cannot `SELECT` the row, Realtime simply does not send the event. There is no error, no `CHANNEL_ERROR`, no log entry visible to the developer. The channel status shows `SUBSCRIBED` but events never arrive.

**Consequences:**
- Dashboard appears to work (WebSocket connection open, status "SUBSCRIBED") but never updates
- Silent failure during acceptance testing — hard to catch without explicit test data
- New tables added in migrations 004–011 (e.g., `message_threads`, `appointment_slots`) will have this problem unless RLS SELECT policies are defined before Realtime subscriptions are set up

**Prevention:**
1. After enabling RLS on any table, immediately define a SELECT policy: `CREATE POLICY "tenant_select" ON appointments FOR SELECT USING (tenant_id = auth.jwt()->>'tenant_id');`
2. Before implementing Realtime subscription code, verify in Supabase Dashboard > SQL Editor: `SELECT * FROM appointments WHERE tenant_id = '[your_tenant]'` using an authenticated user's JWT.
3. Test Realtime in isolation: subscribe to a channel in browser console, insert a row in the Dashboard SQL editor, confirm the event arrives.
4. Use Supabase Dashboard > Realtime Inspector to watch live events.

**Detection (warning signs):**
- Channel status shows `SUBSCRIBED` but no events received when rows are inserted/updated
- Table has RLS enabled but `pg_policies` returns empty for that table
- New tables from migrations 004–011 that never had SELECT policies written

**Phase that should address this:** Realtime setup phase — before writing any subscription code, audit all tables for RLS SELECT policies

---

### Pitfall 4: Table Not Added to `supabase_realtime` Publication

**What goes wrong:**
Client code subscribes to changes on a table (e.g., `appointments`, `message_threads`) but no events arrive because the table was never added to the `supabase_realtime` PostgreSQL publication.

**Why it happens:**
Migrations that create new tables do not automatically add those tables to the `supabase_realtime` publication. Tables must be explicitly opted in via the Supabase Dashboard (Database > Publications > supabase_realtime) or via SQL: `ALTER PUBLICATION supabase_realtime ADD TABLE appointments;`

The existing polling code never needed this. When upgrading from polling to Realtime, developers skip this infrastructure step.

**Consequences:**
- Subscriptions silently receive zero events (identical symptom to Pitfall 3 above, making debugging harder)
- All 11 new tables from migrations 004–011 will be missing from the publication by default

**Prevention:**
1. Create a checklist migration step: for every table that needs Realtime, add `ALTER PUBLICATION supabase_realtime ADD TABLE [table_name];` at the end of the migration file that creates the table.
2. Verify in Dashboard > Database > Publications that the relevant tables are listed under `supabase_realtime`.
3. Maintain a whitelist — only add tables that actually need real-time (do not add all tables, as this increases WAL volume).

**Detection (warning signs):**
- `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';` does not list your target table
- Events are 100% absent even though RLS policies are correct

**Phase that should address this:** Migration phase — add publication statements to migration files for `appointments` and any status-tracking tables

---

### Pitfall 5: Multi-Tenant Realtime Data Leak via Insufficient Subscription Filtering

**What goes wrong:**
Staff member from Clinic A receives appointment status updates for Clinic B in real-time, because the subscription has no `filter` clause and RLS is misconfigured.

**Why it happens:**
Two conditions combine: (1) the client-side subscription uses `table: 'appointments'` with no `filter` option, and (2) either the RLS policy is missing or was written incorrectly (e.g., using `auth.uid()` when the policy should check `tenant_id` from JWT claims). Realtime evaluates RLS to determine what to send, but if the policy accidentally allows cross-tenant access, all events for all tenants stream to every connected client.

**Consequences:**
- Patient data from one clinic visible to another clinic's staff — a GDPR/HIPAA-equivalent breach
- For a medical SaaS this is existential: one leak destroys trust permanently

**Prevention:**
1. Always add a `filter` to Realtime subscriptions as defense-in-depth: `.on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: 'tenant_id=eq.' + tenantId }, ...)`
2. Never rely solely on RLS for Realtime scoping — filter at the subscription level AND at the RLS level.
3. Write a test: authenticated as Tenant A's user, insert a row for Tenant B's `tenant_id`. Confirm the Tenant A subscription does NOT receive the event.
4. Validate `tenant_id` comes from the server-side auth session, not from a client-side variable that a user could manipulate.
5. Audit all RLS policies: `SELECT schemaname, tablename, policyname, qual FROM pg_policies WHERE tablename = 'appointments';` — the `qual` column must reference `tenant_id`.

**Detection (warning signs):**
- Subscription `filter` parameter is absent or set to `'*'`
- RLS policy `USING` clause uses `auth.uid()` on a multi-tenant table that uses `tenant_id` instead
- During testing, authenticated as one tenant, you receive events belonging to another tenant's rows

**Phase that should address this:** Realtime implementation phase — every subscription must include both RLS + filter parameter

---

## Moderate Pitfalls

---

### Pitfall 6: WebSocket Subscription Memory Leak in React App Router

**What goes wrong:**
Each React component that subscribes to Supabase Realtime channels creates a WebSocket channel. When the component unmounts (route change, tab switch), the channel is not removed. Channels accumulate, consuming memory, triggering duplicate event handlers, and eventually hitting Supabase's concurrent channel limits.

**Why it happens:**
Supabase does not automatically clean up subscriptions when React components unmount. Without an explicit `supabase.removeChannel(channel)` in the `useEffect` cleanup function, channels persist even after the component is gone. Supabase only auto-cleans subscriptions after 30 seconds of client disconnect — not on component unmount.

**Consequences:**
- Duplicate event handlers: an update triggers 3 state updates instead of 1 because 3 stale channel listeners exist
- Memory growth over time (staff leave browser tab open all day)
- Hitting free tier limit (500 concurrent connections across the project — each unmounted-but-not-cleaned channel counts)

**Prevention:**
```typescript
useEffect(() => {
  const channel = supabase
    .channel('appointments-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `tenant_id=eq.${tenantId}` }, handleChange)
    .subscribe();

  return () => {
    supabase.removeChannel(channel); // MANDATORY cleanup
  };
}, [tenantId]); // Dependency array must be correct
```
Never put subscription code in the component body — only inside `useEffect`.

**Detection (warning signs):**
- Same appointment update triggers multiple toast notifications
- Browser memory steadily increases during normal use (observable in Chrome DevTools > Memory)
- Console shows multiple `SUBSCRIBED` confirmations for the same channel name

**Phase that should address this:** Realtime implementation phase — code review checklist item

---

### Pitfall 7: React Strict Mode Double-Mount Creates Duplicate Subscriptions (Dev Only)

**What goes wrong:**
In development with Next.js App Router, React Strict Mode mounts and unmounts components twice before the final mount. This triggers `useEffect` twice, creating two Supabase subscriptions. In development, you see double events and the subscription may immediately receive a `CLOSED` status on the first mount before reconnecting.

**Why it happens:**
React 18 Strict Mode intentionally double-invokes `useEffect` in development to help detect missing cleanup functions. Supabase Realtime's `subscribe()` call responds to the immediate unmount by sending `CLOSED` signal, which can confuse status-checking logic.

**Consequences:**
- Confusing development-only bugs that don't exist in production
- Status checks like `if (status === 'CLOSED') alert(user)` fire spuriously in dev
- Developers waste time debugging non-issues or (worse) disable Strict Mode to avoid them

**Prevention:**
1. Ensure cleanup function always calls `supabase.removeChannel(channel)` — this fixes the root cause.
2. Do not check for `CLOSED` status as an error condition in isolation; combine with retry count or elapsed time.
3. Do not disable `reactStrictMode` in `next.config.js` — the double-invoke is a safety feature.
4. Test in production build (`next build && next start`) for final validation, not just development mode.

**Detection (warning signs):**
- Two `SUBSCRIBED` logs per page load in development only
- Subscription status shows `CLOSED` immediately then `SUBSCRIBED` seconds later (development only)
- Behavior disappears in production build

**Phase that should address this:** Realtime implementation phase — awareness item, not a bug

---

### Pitfall 8: Race Condition Between Initial Data Fetch and Subscription Start

**What goes wrong:**
The component fetches the current list of appointments (initial state), then starts the Realtime subscription. Between the fetch completing and the subscription becoming active, a WhatsApp confirmation comes in and updates an appointment status. The dashboard shows stale data — it missed the change — and real-time events from that point forward reflect the wrong starting state.

**Why it happens:**
There is an inherent time gap between `SELECT * FROM appointments` completing and the WebSocket subscription being acknowledged by Supabase. Any mutations during this window are lost. Supabase Realtime is change-notification, not snapshot streaming — you get events, not current state.

**Consequences:**
- Dashboard shows appointment as "pending" when it is actually "confirmed"
- Staff send a duplicate confirmation WhatsApp message, confusing the patient
- The stale state self-corrects only on the next change event (possibly minutes later)

**Prevention:**
1. Use TanStack Query (React Query) as the state layer: fetch initial data with `useQuery`, then use the Realtime subscription to call `queryClient.invalidateQueries(['appointments'])` on each event. This re-fetches fresh data from the DB rather than applying stale delta updates.
2. Alternatively: subscribe first, await `SUBSCRIBED` status, then fetch initial state. This eliminates the window.
3. Do NOT apply event payloads directly to local state as if they represent complete current state — always re-fetch or merge carefully.

**Detection (warning signs):**
- Appointment status visible in Supabase Dashboard does not match what the dashboard component displays
- WhatsApp webhook fires, status updates in DB, but dashboard shows previous status for 30+ seconds
- Loading spinner completes but data is already out of date on first render

**Phase that should address this:** Realtime implementation phase — state management design decision

---

### Pitfall 9: Vercel Serverless Functions Cannot Maintain Realtime WebSocket Connections

**What goes wrong:**
A developer attempts to initiate or maintain a Supabase Realtime subscription inside a Next.js API Route or Route Handler (serverless function). The subscription times out or never fires because Vercel serverless functions terminate after the response is sent and cannot hold open WebSocket connections.

**Why it happens:**
Serverless functions are stateless and short-lived. They respond to a request and die. WebSocket connections require a persistent process. Supabase Realtime connections must live on the client browser, not in a Vercel serverless function.

**Consequences:**
- WhatsApp webhooks that try to notify the dashboard via Realtime from the server side will fail silently
- Developers may incorrectly think Supabase Realtime is broken when the issue is architectural

**Prevention:**
1. Supabase Realtime subscriptions belong exclusively in React client components (`'use client'`) running in the browser.
2. The correct architecture: Twilio webhook → Vercel API Route (serverless) → updates database → Supabase Realtime detects DB change via WAL → broadcasts to browser client.
3. Never import `supabase.channel()` in a server component, API route, or Edge Function for subscription purposes.
4. For server-to-client push needs beyond Postgres Changes, use Supabase Realtime Broadcast from the Database feature (available in recent Supabase versions).

**Detection (warning signs):**
- `supabase.channel().subscribe()` called inside `app/api/*/route.ts`
- Real-time "push" logic inside server-side code
- Subscription callback never fires despite correct client-side setup

**Phase that should address this:** Architecture review before Realtime implementation

---

### Pitfall 10: Supabase Realtime Has No Long-Polling Fallback

**What goes wrong:**
In environments where WebSockets are blocked (corporate firewalls, certain hospital network configurations, some mobile networks), Supabase Realtime silently fails. There is no automatic fallback to HTTP long-polling or SSE.

**Why it happens:**
Unlike Firebase Realtime Database or Socket.io, Supabase Realtime is WebSocket-only. It does not fall back to long-polling. If the WebSocket connection cannot be established, the subscription never reaches `SUBSCRIBED` status.

**Consequences:**
- Staff on restricted clinic networks lose all real-time updates
- No error shown to the user — dashboard appears to work (initial data loads fine)
- The 30-second polling that currently exists would be the de facto experience — inadvertently better than the failed Realtime

**Prevention:**
1. Implement a heartbeat/connection-status check: monitor `supabase.realtime.connectionState` and show a visible banner ("Live updates paused — refreshing every 30 seconds") when WebSocket is not connected.
2. Keep a polling fallback active only when Realtime is disconnected — poll every 30 seconds as before, but suppress it when WebSocket is healthy.
3. Test with WebSocket blocked in browser DevTools (Network tab > Block request type: WebSocket).

**Detection (warning signs):**
- Subscription status never reaches `SUBSCRIBED` for some users
- No events received despite DB changes occurring
- Happens only on certain networks, not all staff

**Phase that should address this:** Realtime resilience phase — add health indicator and graceful fallback

---

## Minor Pitfalls

---

### Pitfall 11: Forgetting `REPLICA IDENTITY FULL` for UPDATE/DELETE Events

**What goes wrong:**
Realtime UPDATE and DELETE events arrive with `old_record: null` — you cannot determine what changed or identify which row was deleted.

**Why it happens:**
By default, Postgres replication only includes the primary key in the old record for UPDATE and DELETE. Realtime inherits this behavior. Without `REPLICA IDENTITY FULL`, the change payload is incomplete.

**Prevention:**
For tables that need full change context (appointments especially): `ALTER TABLE appointments REPLICA IDENTITY FULL;`

Add this to the migration file alongside the publication addition.

**Caveat:** When both RLS and `REPLICA IDENTITY FULL` are enabled, the `old_record` field only contains primary keys (RLS prevents leaking pre-change data). Workaround: use event payload to trigger a re-fetch of current state via TanStack Query.

**Phase that should address this:** Realtime setup phase

---

### Pitfall 12: Anon Key Realtime Sessions Expire After 24 Hours

**What goes wrong:**
A user opens the dashboard tab and leaves it open overnight. The next morning, the Realtime subscription is silently disconnected because anonymous (unauthenticated) WebSocket sessions expire after 24 hours.

**Why it happens:**
Supabase Realtime sessions based on the anon key last 24 hours maximum without re-authentication. When using Supabase Auth (authenticated sessions), the JWT must be refreshed and the Realtime client re-authenticated.

**Prevention:**
1. Use Supabase Auth with `supabase.auth.startAutoRefresh()` in client components.
2. Verify the Supabase client is configured with `autoRefreshToken: true` (default in `createBrowserClient`).
3. Add a page visibility handler: when the tab regains visibility after a long absence, check `supabase.realtime.connectionState` and reconnect if needed.

**Phase that should address this:** Realtime implementation phase

---

### Pitfall 13: RLS Policy Ordering — `ALTER TABLE ENABLE ROW LEVEL SECURITY` Without Policies Locks Out All Users

**What goes wrong:**
A migration enables RLS on a new table (`ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY`) but no policies are created in the same migration. Until policies are added, all rows are inaccessible to ALL users (including your own tenant) — RLS denies by default.

**Why it happens:**
Developers enable RLS first (correctly), intending to add policies in a subsequent migration. But the deployment pipeline runs the first migration to production before the second migration is ready. The window between migrations leaves the table locked.

**Consequences:**
- New tables added in migrations 004–011 become inaccessible upon deployment
- Application queries to those tables return empty results silently

**Prevention:**
1. Always include RLS `ENABLE` and at minimum one `SELECT` policy in the same migration file.
2. Template: `ALTER TABLE new_table ENABLE ROW LEVEL SECURITY; CREATE POLICY "tenant_select" ON new_table FOR SELECT USING (tenant_id = (auth.jwt()->>'tenant_id')::uuid);`
3. Never split enable + policy across separate migrations.

**Phase that should address this:** Migration phase — review all 8 pending migrations for this pattern

---

### Pitfall 14: Supabase Realtime Free Tier Limits

**What goes wrong:**
For a small clinic with 2–5 staff, concurrent connection limits are not a practical concern. But if multiple browser tabs are open per staff member (common), and each tab creates multiple channels (appointments + calendar + notifications), the per-project concurrent connection count grows quickly.

**Known limits (as of 2025–2026):**
- Free tier: 500 concurrent connections per project
- Each client can join multiple channels per connection
- Rate limit: too many channel joins per second disconnects the client
- Message size: 1 MB maximum per message

**Prevention:**
1. Reuse a single Supabase client singleton across the entire app (do not instantiate `createBrowserClient` multiple times).
2. Consolidate subscriptions: one channel for `appointments` table changes, not one channel per appointment row.
3. Use wildcard subscriptions with filters rather than row-level subscriptions.

**Phase that should address this:** Realtime architecture — singleton client pattern

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Running migrations 004–011 in production | Data loss, table lock-out from RLS without policies | Backup first, review each migration for destructive SQL, include RLS + policy in same file |
| Adding tables to supabase_realtime publication | Forgetting to add new tables | Add `ALTER PUBLICATION supabase_realtime ADD TABLE ...` to each relevant migration file |
| First Realtime subscription implementation | service_role key used client-side | Audit all env vars before writing any subscription code |
| Dashboard component subscribing to appointments | Memory leak from missing cleanup | Code review checklist: every `useEffect` with `subscribe()` must have `removeChannel()` cleanup |
| Multi-tenant subscription scoping | Cross-tenant data leak | Both RLS SELECT policy AND filter parameter required — test explicitly with two tenant sessions |
| State initialization with Realtime | Race condition producing stale initial state | Use TanStack Query `invalidateQueries` pattern instead of direct state mutation from event payload |
| Vercel deployment of Realtime code | Subscription in API route / server component | Architecture review — subscriptions are client-browser-only |
| Long-running staff browser sessions | Expired sessions, silent disconnection | Auto-refresh token + visibility change handler + connection status banner |
| UI showing real-time status | No indication when WebSocket fails | Show connectivity indicator; fall back to polling when disconnected |

---

## Sources

- [Supabase Realtime Authorization Docs](https://supabase.com/docs/guides/realtime/authorization) — RLS requirements, beta status
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits) — concurrent connections, rate limits
- [Supabase Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod) — RLS, backup requirements
- [Supabase RLS Performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) — performance impact guidance
- [Supabase Realtime Troubleshooting](https://supabase.com/docs/guides/realtime/troubleshooting) — official debug guide
- [Supabase Realtime Silent Disconnections](https://supabase.com/docs/guides/troubleshooting/realtime-handling-silent-disconnections-in-backgrounded-applications-592794) — heartbeat and reconnection
- [Supabase Understanding API Keys](https://supabase.com/docs/guides/api/api-keys) — service_role vs anon key
- [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) — publication setup, REPLICA IDENTITY
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs) — official App Router integration guide
- [Vercel Serverless WebSocket Limitations](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections) — no WS in serverless functions
- [Vercel Publish/Subscribe Guide](https://vercel.com/kb/guide/publish-and-subscribe-to-realtime-data-on-vercel) — recommended Vercel + Realtime architecture
- [Supabase Realtime Memory Leak Diagnosis](https://drdroid.io/stack-diagnosis/supabase-realtime-client-side-memory-leak) — memory leak patterns
- [supabase/realtime-js Issue #169 — Strict Mode double subscribe](https://github.com/supabase/realtime-js/issues/169) — React Strict Mode bug
- [Realtime race condition discussion](https://github.com/orgs/supabase/discussions/5641) — reliable Realtime patterns
- [Enforcing RLS in Multi-Tenant Supabase](https://dev.to/blackie360/-enforcing-row-level-security-in-supabase-a-deep-dive-into-lockins-multi-tenant-architecture-4hd2) — multi-tenant patterns
- [Makerkit Supabase RLS Best Practices](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) — production RLS patterns
- [Using TanStack Query with Supabase Realtime](https://makerkit.dev/blog/saas/supabase-react-query) — state management integration
- [Fix Supabase Realtime when RLS is enabled (Medium)](https://medium.com/@kidane10g/supabase-realtime-stops-working-when-rls-is-enabled-heres-the-fix-154f0b43c69a) — silent failure diagnosis
- [Supabase Security Retro 2025](https://supaexplorer.com/dev-notes/supabase-security-2025-whats-new-and-how-to-stay-secure.html) — key migration timeline
