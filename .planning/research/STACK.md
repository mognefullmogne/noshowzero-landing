# Technology Stack

**Project:** NoShowZero — Real-Time Dashboard Milestone
**Researched:** 2026-03-03
**Scope:** Adding Supabase Realtime, fixing production DB migrations, real-time notification UX

---

## Context: What Already Exists

The project already has all core dependencies installed and correctly configured:

| Package | Installed Version | Role |
|---------|------------------|------|
| `@supabase/supabase-js` | ^2.98.0 (latest: 2.80.0 — verify npm) | Main Supabase client |
| `@supabase/ssr` | ^0.9.0 (latest: 0.8.0 confirmed) | Browser + server client factory |
| `next` | 16.1.6 | App Router framework |
| `react` | 19.2.3 | UI runtime |

The existing client setup in `src/lib/supabase/client.ts` uses `createBrowserClient` from `@supabase/ssr` — this is the correct, current pattern (not the deprecated `@supabase/auth-helpers-nextjs`). No client library changes are needed for Realtime; the existing client supports it out of the box.

---

## Recommended Stack

### 1. Supabase Realtime — Postgres Changes (PRIMARY)

**What it does:** Listens to `INSERT`, `UPDATE`, `DELETE` events on specific tables via PostgreSQL logical replication over WebSockets. No additional infrastructure required; included in Supabase free and pro tiers.

**API pattern (using existing client):**

```typescript
// In a 'use client' component
import { createClient } from "@/lib/supabase/client";

useEffect(() => {
  const supabase = createClient();

  const channel = supabase
    .channel("appointments-changes")
    .on(
      "postgres_changes",
      {
        event: "*",              // INSERT | UPDATE | DELETE | *
        schema: "public",
        table: "appointments",
        filter: `tenant_id=eq.${tenantId}`, // RLS-scoped, tenant-isolated
      },
      (payload) => {
        // payload.eventType: 'INSERT' | 'UPDATE' | 'DELETE'
        // payload.new: new row values
        // payload.old: old values (requires REPLICA IDENTITY FULL)
        handleChange(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel); // Always clean up in useEffect return
  };
}, [tenantId]);
```

**Why Postgres Changes over Broadcast/Presence:**
- Appointments state lives in the database. Postgres Changes is the authoritative source — no secondary event bus needed.
- Broadcast is for ephemeral peer-to-peer messages (e.g., live cursors, chat). Not appropriate here.
- Presence tracks who is currently online. Useful only if showing "who's viewing this appointment" — out of scope for this milestone.

**Confidence:** HIGH — documented pattern, matches the existing `createBrowserClient` setup.

---

### 2. Supabase Realtime — Required Database Setup

Before any subscription works, two things must be done per table:

**Step A: Add table to the `supabase_realtime` publication**

Via SQL Editor in Supabase Dashboard (or migration file):

```sql
-- Enable realtime for the tables that drive the dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.waitlist_entries;
```

Alternatively, toggle tables on in: Dashboard → Database → Replication → supabase_realtime.

**Step B: Set REPLICA IDENTITY FULL (optional but recommended)**

Required only if you need the `old` record values on UPDATE/DELETE events:

```sql
ALTER TABLE public.appointments REPLICA IDENTITY FULL;
```

Caveat: When RLS is enabled AND REPLICA IDENTITY FULL is set, the `old` record contains only primary key columns (Supabase security design). For this app's use case (refreshing appointment status on change), this is fine — `payload.new` is what matters.

**Confidence:** HIGH — official Supabase documentation.

---

### 3. RLS-Scoped Multi-Tenant Subscriptions

**The pattern:** Use the `filter` option on the channel subscription to scope events to the authenticated tenant. Supabase Realtime respects the authenticated user's RLS policies — events are only delivered if the subscribing user can SELECT that row.

```typescript
// Good: filter reduces events server-side, RLS acts as second layer
.on("postgres_changes", {
  event: "*",
  schema: "public",
  table: "appointments",
  filter: `tenant_id=eq.${tenantId}`,
}, handler)
```

**What NOT to do:** Subscribe to `*` (all rows) and filter client-side. This overloads the Realtime connection and leaks inter-tenant event metadata before RLS can act on it.

**Existing RLS:** The project already has RLS on all tables (confirmed in PROJECT.md). The existing policies should automatically scope events. The `filter` param is an additional client-side declaration that also reduces server-side event volume.

**Requirement:** Supabase-js v2.44.0+ is required for channel-level authorization (the project's ^2.98.0 satisfies this).

**Confidence:** HIGH — verified against Supabase Realtime authorization docs.

---

### 4. Production Database Migration Strategy

**Problem:** Migrations 004–011 were never applied to production. The project has 11 SQL files in `supabase/migrations/` with sequential naming (001–011). The Supabase CLI can apply pending migrations without re-running already-applied ones.

**Recommended tool:** Supabase CLI `supabase db push`

**Pattern:**

```bash
# 1. Install Supabase CLI if not present
npm install -g supabase

# 2. Link to the production project (requires SUPABASE_ACCESS_TOKEN and project ref)
supabase link --project-ref <your-project-ref>

# 3. Push pending migrations using Direct connection string
#    (NOT the pooler — db push requires a direct connection)
supabase db push --db-url "postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# OR using the direct DB connection from Supabase Dashboard → Settings → Database
supabase db push --db-url "postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres"
```

**How it works:** On first run, `db push` creates a `supabase_migrations.schema_migrations` table and records which migrations have been applied. On subsequent runs, it skips already-applied migrations. This is safe to run against a production DB with existing data.

**Connection string source:** Supabase Dashboard → Settings → Database → Connection string → "Direct connection" (not the pooler/transaction pooler). The user confirmed they have the correct connection string from the Dashboard.

**Alternative (no CLI):** If the CLI approach is blocked, run each migration file manually in Supabase Dashboard → SQL Editor, in order (004 through 011). Less automated but equally safe.

**Why NOT `supabase migrate deploy`:** This command is for the older migration workflow and has interactive prompts. `db push` is the current recommended command for CI/CD and non-interactive production deploys.

**Confidence:** MEDIUM-HIGH — verified against Supabase CLI docs. The `--db-url` flag behavior is confirmed but percent-encoding of special characters in passwords is a known gotcha.

---

### 5. Toast Notification Library — Sonner

**Recommended:** `sonner` v2.0.7

**Why:** shadcn/ui has officially deprecated its own `<Toast>` component and now recommends Sonner. The project uses shadcn (confirmed in devDependencies). Sonner is the natural default.

**Installation:**

```bash
npm install sonner
```

**Integration in `src/app/layout.tsx`:**

```tsx
import { Toaster } from "sonner";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
```

**Trigger from anywhere:**

```typescript
import { toast } from "sonner";

// When a confirmation arrives via Realtime:
toast.success("Appointment confirmed", {
  description: `${patientName} confirmed their appointment`,
  duration: 5000,
});
```

**Confidence:** HIGH — official shadcn/ui recommendation, verified.

---

### 6. Browser Notification API (Native — No Library)

For out-of-tab alerts (when the clinic staff has the dashboard open in a background tab):

```typescript
// Request permission once (must be triggered by user gesture)
async function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

// Show native notification when Realtime event arrives and tab is not visible
function showBrowserNotification(title: string, body: string) {
  if (Notification.permission === "granted" && document.visibilityState === "hidden") {
    new Notification(title, { body, icon: "/favicon.ico" });
  }
}
```

**Why no library:** The Web Notifications API is stable, well-supported across modern browsers, and zero-dependency. A library wrapping it adds no value for this use case.

**Important:** Always gate permission requests behind a user gesture (e.g., a "Enable notifications" button in the dashboard UI). Browsers block auto-requests on page load.

**Confidence:** HIGH — standard Web API, MDN documented.

---

### 7. Audio Notifications — Web Audio API (Native — No Library)

For appointment confirmation sound alerts:

```typescript
function playConfirmationSound() {
  const ctx = new AudioContext();
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.frequency.value = 880;
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.3);
}
```

Alternative: serve a short `.mp3` file in `public/sounds/confirm.mp3` and use `new Audio("/sounds/confirm.mp3").play()`. This is simpler and produces a less jarring sound than a synthesized tone.

**Why no library:** No justification for a dependency here. `new Audio()` is one line.

**Confidence:** HIGH — standard Web API.

---

## What NOT to Use

| Approach | Why Not |
|----------|---------|
| **Pusher / Ably** | Already on Supabase; Realtime is included at no extra cost. Extra vendor = extra complexity and cost. |
| **Custom WebSocket server** | Vercel is serverless — persistent WebSocket connections are not possible. Supabase Realtime handles the WS connection client-side over their infrastructure. |
| **Server-Sent Events (SSE) from Next.js route handlers** | Technically possible via `ReadableStream` in Vercel Edge Functions, but limited to 25-second max timeout on Vercel serverless. Not viable for persistent dashboard connections. |
| **`@supabase/auth-helpers-nextjs`** | Deprecated. The project already uses the correct replacement (`@supabase/ssr`). Do not install this package. |
| **Polling (current approach)** | The existing 30-second `setInterval` polling in `appointments/page.tsx` should be removed once Realtime is wired up. Polling and Realtime subscriptions on the same data create duplicate state update paths. |
| **React Query / SWR for Realtime** | React Query and SWR have built-in refetchInterval but they are not WebSocket-aware. Mixing them with Supabase Realtime channels creates complex cache invalidation problems. Keep Realtime state in local `useState` and React Query for initial loads only (or bypass entirely). |
| **`react-hot-toast`** | Viable but shadcn now officially recommends Sonner. Stay consistent with the design system. |

---

## Summary of Dependencies to Add

```bash
# Only one new runtime dependency is needed for this milestone:
npm install sonner

# No other packages — Supabase Realtime is part of @supabase/supabase-js (already installed)
# No additional infrastructure, services, or configuration beyond Supabase Dashboard toggles
```

---

## Installation Checklist

- [ ] `npm install sonner` — add `<Toaster />` to root layout
- [ ] Enable `supabase_realtime` publication for `appointments` table (SQL or Dashboard)
- [ ] Apply migrations 004–011 via `supabase db push --db-url <direct-connection-string>`
- [ ] Add `useRealtimeAppointments` hook (`src/hooks/use-realtime-appointments.ts`)
- [ ] Remove 30-second polling intervals once Realtime is live

---

## Sources

- [Supabase Realtime — Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) — HIGH confidence
- [Supabase Realtime — Authorization](https://supabase.com/docs/guides/realtime/authorization) — HIGH confidence
- [Supabase Realtime with Next.js](https://supabase.com/docs/guides/realtime/realtime-with-nextjs) — HIGH confidence
- [Supabase CLI — db push](https://supabase.com/docs/reference/cli/supabase-db-push) — HIGH confidence
- [Creating a Supabase client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client) — HIGH confidence
- [Sonner — npm](https://www.npmjs.com/package/sonner) — HIGH confidence (v2.0.7, shadcn official)
- [shadcn/ui Sonner integration](https://ui.shadcn.com/docs/components/radix/sonner) — HIGH confidence
- [MDN — Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API) — HIGH confidence
- [Realtime RLS — Supabase blog](https://supabase.com/blog/realtime-row-level-security-in-postgresql) — MEDIUM confidence (verify against current docs)
- [@supabase/supabase-js — npm](https://www.npmjs.com/package/@supabase/supabase-js) — HIGH confidence (v2.80.0 latest confirmed)
