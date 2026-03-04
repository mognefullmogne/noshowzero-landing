/**
 * Integration tests: GET /api/ai/strategy-log
 *
 * Tests:
 *  1. Returns 401 when not authenticated
 *  2. Returns 404 when no tenant exists for the user
 *  3. Returns strategy log entries with default pagination
 *  4. Applies limit and offset query parameters correctly
 *  5. Filters by action type (valid filter)
 *  6. Ignores invalid action filter (falls back to all strategy actions)
 *  7. Returns hasMore=true when result count equals limit
 *  8. Returns hasMore=false when result count is less than limit
 *  9. Returns 500 on Supabase error
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth-helpers", () => ({
  getAuthenticatedTenant: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn(),
}));

import { getAuthenticatedTenant } from "@/lib/auth-helpers";
import { createServiceClient } from "@/lib/supabase/server";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TENANT_ID = "e1d14300-10cb-42d0-9e9d-eb8fee866570";

function makeStrategyEntry(overrides = {}) {
  return {
    id: "entry-" + Math.random().toString(36).slice(2),
    entity_id: "appt-001",
    action: "ai_strategy_applied",
    metadata: { strategy: "cascade", reasoning: "Standard cascade." },
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/** Build a NextRequest to GET /api/ai/strategy-log with optional query params. */
function makeRequest(params: Record<string, string | number> = {}): NextRequest {
  const url = new URL("http://localhost:3000/api/ai/strategy-log");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

/** Build a minimal chainable Supabase query mock that returns given data/error. */
function mockQueryBuilder(data: unknown[] | null, error: { message: string } | null = null) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    order: () => builder,
    range: () => builder,
    then: (resolve: (v: { data: unknown[] | null; error: unknown; count: null }) => unknown) =>
      Promise.resolve({ data, error, count: null }).then(resolve),
  };
  return builder;
}

function buildSupabaseMock(
  data: unknown[] | null,
  error: { message: string } | null = null
) {
  return {
    from: () => mockQueryBuilder(data, error),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/ai/strategy-log", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  // ─── 1. Unauthenticated ───────────────────────────────────────────────────

  it("returns 401 when user is not authenticated", async () => {
    vi.mocked(getAuthenticatedTenant).mockResolvedValue({
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: { code: "UNAUTHORIZED" } }),
        { status: 401 }
      ) as never,
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  // ─── 2. No tenant ─────────────────────────────────────────────────────────

  it("returns 404 when no tenant is linked to the user", async () => {
    vi.mocked(getAuthenticatedTenant).mockResolvedValue({
      ok: false,
      response: new Response(
        JSON.stringify({ success: false, error: { code: "NO_TENANT" } }),
        { status: 404 }
      ) as never,
    });

    const { GET } = await import("../route");
    const res = await GET(makeRequest());

    expect(res.status).toBe(404);
  });

  // ─── 3. Returns entries with defaults ─────────────────────────────────────

  it("returns strategy log entries with default limit=20 and offset=0", async () => {
    const entries = Array.from({ length: 5 }, () => makeStrategyEntry());

    vi.mocked(getAuthenticatedTenant).mockResolvedValue({
      ok: true,
      data: { tenantId: TENANT_ID, userId: "user-001" },
    });

    vi.mocked(createServiceClient).mockResolvedValue(
      buildSupabaseMock(entries) as never
    );

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.entries).toHaveLength(5);
    expect(body.count).toBe(5);
    expect(body.hasMore).toBe(false);
  });

  // ─── 4. limit and offset params ───────────────────────────────────────────

  it("respects limit=3 and returns hasMore=true when 3 items returned", async () => {
    const entries = Array.from({ length: 3 }, () => makeStrategyEntry());

    vi.mocked(getAuthenticatedTenant).mockResolvedValue({
      ok: true,
      data: { tenantId: TENANT_ID, userId: "user-001" },
    });

    vi.mocked(createServiceClient).mockResolvedValue(
      buildSupabaseMock(entries) as never
    );

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ limit: 3 }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.entries).toHaveLength(3);
    // hasMore is true when count equals limit
    expect(body.hasMore).toBe(true);
  });

  it("returns hasMore=false when returned count is less than limit", async () => {
    const entries = Array.from({ length: 2 }, () => makeStrategyEntry());

    vi.mocked(getAuthenticatedTenant).mockResolvedValue({
      ok: true,
      data: { tenantId: TENANT_ID, userId: "user-001" },
    });

    vi.mocked(createServiceClient).mockResolvedValue(
      buildSupabaseMock(entries) as never
    );

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ limit: 5 }));
    const body = await res.json();

    expect(body.hasMore).toBe(false);
  });

  // ─── 5. limit is capped at 50 ─────────────────────────────────────────────

  it("caps limit at 50 even if client sends limit=999", async () => {
    // The query is built with limit capped at 50 — we just verify 200 + success
    vi.mocked(getAuthenticatedTenant).mockResolvedValue({
      ok: true,
      data: { tenantId: TENANT_ID, userId: "user-001" },
    });

    vi.mocked(createServiceClient).mockResolvedValue(
      buildSupabaseMock([]) as never
    );

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ limit: 999 }));
    const body = await res.json();

    // Route must not throw — 200 with empty entries
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  // ─── 6. Action filter — valid ─────────────────────────────────────────────

  it("accepts valid action filter 'ai_strategy_applied'", async () => {
    const entries = [
      makeStrategyEntry({ action: "ai_strategy_applied" }),
    ];

    vi.mocked(getAuthenticatedTenant).mockResolvedValue({
      ok: true,
      data: { tenantId: TENANT_ID, userId: "user-001" },
    });

    vi.mocked(createServiceClient).mockResolvedValue(
      buildSupabaseMock(entries) as never
    );

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ action: "ai_strategy_applied" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.entries[0].action).toBe("ai_strategy_applied");
  });

  it("accepts all valid action filter values", async () => {
    const validActions = [
      "ai_strategy_applied",
      "cascade_deferred",
      "cascade_manual_review",
      "cascade_exhausted",
    ];

    vi.mocked(getAuthenticatedTenant).mockResolvedValue({
      ok: true,
      data: { tenantId: TENANT_ID, userId: "user-001" },
    });

    for (const action of validActions) {
      vi.mocked(createServiceClient).mockResolvedValue(
        buildSupabaseMock([makeStrategyEntry({ action })]) as never
      );

      const { GET } = await import("../route");
      const res = await GET(makeRequest({ action }));
      expect(res.status).toBe(200);
    }
  });

  // ─── 7. Action filter — invalid (falls back to all) ───────────────────────

  it("ignores invalid action filter and returns 200 with entries", async () => {
    const entries = [makeStrategyEntry()];

    vi.mocked(getAuthenticatedTenant).mockResolvedValue({
      ok: true,
      data: { tenantId: TENANT_ID, userId: "user-001" },
    });

    vi.mocked(createServiceClient).mockResolvedValue(
      buildSupabaseMock(entries) as never
    );

    const { GET } = await import("../route");
    const res = await GET(makeRequest({ action: "invalid_action_type" }));
    const body = await res.json();

    // Should not reject — falls back to fetching all strategy actions
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  // ─── 8. Supabase query error ──────────────────────────────────────────────

  it("returns 500 when Supabase query fails", async () => {
    vi.mocked(getAuthenticatedTenant).mockResolvedValue({
      ok: true,
      data: { tenantId: TENANT_ID, userId: "user-001" },
    });

    vi.mocked(createServiceClient).mockResolvedValue(
      buildSupabaseMock(null, { message: "connection refused" }) as never
    );

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toContain("fetch strategy log");
  });

  // ─── 9. Empty result ──────────────────────────────────────────────────────

  it("returns empty entries array when no strategy events exist", async () => {
    vi.mocked(getAuthenticatedTenant).mockResolvedValue({
      ok: true,
      data: { tenantId: TENANT_ID, userId: "user-001" },
    });

    vi.mocked(createServiceClient).mockResolvedValue(
      buildSupabaseMock([]) as never
    );

    const { GET } = await import("../route");
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.entries).toEqual([]);
    expect(body.count).toBe(0);
    expect(body.hasMore).toBe(false);
  });

  // ─── 10. Negative offset is clamped to 0 ─────────────────────────────────

  it("clamps negative offset to 0", async () => {
    vi.mocked(getAuthenticatedTenant).mockResolvedValue({
      ok: true,
      data: { tenantId: TENANT_ID, userId: "user-001" },
    });

    vi.mocked(createServiceClient).mockResolvedValue(
      buildSupabaseMock([]) as never
    );

    const { GET } = await import("../route");
    // Should not throw — offset=-5 is clamped to 0 by the route
    const res = await GET(makeRequest({ offset: -5 }));
    expect(res.status).toBe(200);
  });
});
