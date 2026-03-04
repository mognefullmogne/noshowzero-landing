import { describe, it, expect, vi, beforeEach } from "vitest";
import { invalidateAnalysisCache } from "../no-show-analysis";

// We test the pure internal logic by importing private helpers indirectly
// through the exported types and the cache invalidation function.
// The core aggregation logic is tested via the public analyzeNoShowPatterns
// with a mocked Supabase client.

// ---------------------------------------------------------------------------
// Cache invalidation
// ---------------------------------------------------------------------------

describe("invalidateAnalysisCache", () => {
  it("does not throw when called for an unknown tenant", () => {
    expect(() => invalidateAnalysisCache("non-existent-tenant")).not.toThrow();
  });

  it("does not throw when called multiple times", () => {
    expect(() => {
      invalidateAnalysisCache("tenant-1");
      invalidateAnalysisCache("tenant-1");
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// analyzeNoShowPatterns — with mocked Supabase
// ---------------------------------------------------------------------------

function makeSupabaseMock(appointments: Record<string, unknown>[]) {
  const chainable = {
    select: () => chainable,
    eq: () => chainable,
    gte: () => chainable,
    in: () => chainable,
    order: () => chainable,
    then: (resolve: (val: { data: typeof appointments; error: null }) => void) => {
      resolve({ data: appointments, error: null });
      return Promise.resolve({ data: appointments, error: null });
    },
  };

  return {
    from: () => chainable,
  };
}

describe("analyzeNoShowPatterns", () => {
  beforeEach(() => {
    // Ensure no cached results from previous tests
    invalidateAnalysisCache("test-tenant");
  });

  it("returns empty aggregates when no appointments", async () => {
    // We need to import here to avoid top-level await issues
    const { analyzeNoShowPatterns } = await import("../no-show-analysis");
    const supabase = makeSupabaseMock([]) as unknown as Parameters<typeof analyzeNoShowPatterns>[0];

    invalidateAnalysisCache("test-tenant");
    const result = await analyzeNoShowPatterns(supabase, "test-tenant");

    expect(result.data.totalAppointments).toBe(0);
    expect(result.data.totalNoShows).toBe(0);
    expect(result.data.overallNoShowRate).toBe(0);
    expect(result.generatedAt).toBeTruthy();
    expect(typeof result.analysis).toBe("string");
  });

  it("computes correct no-show rate from appointment data", async () => {
    const { analyzeNoShowPatterns } = await import("../no-show-analysis");

    const now = new Date("2026-03-04T10:00:00Z");
    const createdAt = new Date("2026-02-01T10:00:00Z").toISOString();

    const appointments = [
      { id: "1", patient_id: "p1", provider_name: "Dr. Rossi", service_name: "Visita", scheduled_at: now.toISOString(), created_at: createdAt, status: "completed" },
      { id: "2", patient_id: "p2", provider_name: "Dr. Rossi", service_name: "Visita", scheduled_at: now.toISOString(), created_at: createdAt, status: "no_show" },
      { id: "3", patient_id: "p3", provider_name: "Dr. Bianchi", service_name: "Controllo", scheduled_at: now.toISOString(), created_at: createdAt, status: "no_show" },
      { id: "4", patient_id: "p4", provider_name: "Dr. Bianchi", service_name: "Controllo", scheduled_at: now.toISOString(), created_at: createdAt, status: "confirmed" },
    ];

    // Supabase mock that also handles the patients query for repeat offenders
    const chainable = {
      select: () => chainable,
      eq: () => chainable,
      gte: () => chainable,
      in: () => chainable,
      order: () => chainable,
      then: (resolve: (val: { data: typeof appointments; error: null }) => void) => {
        resolve({ data: appointments, error: null });
        return Promise.resolve({ data: appointments, error: null });
      },
    };
    const supabase = { from: () => chainable } as unknown as Parameters<typeof analyzeNoShowPatterns>[0];

    invalidateAnalysisCache("test-tenant-2");
    const result = await analyzeNoShowPatterns(supabase, "test-tenant-2");

    expect(result.data.totalAppointments).toBe(4);
    expect(result.data.totalNoShows).toBe(2);
    expect(result.data.overallNoShowRate).toBe(50);
  });

  it("returns cached result on second call", async () => {
    const { analyzeNoShowPatterns } = await import("../no-show-analysis");
    const supabase = makeSupabaseMock([]) as unknown as Parameters<typeof analyzeNoShowPatterns>[0];

    invalidateAnalysisCache("cache-test-tenant");

    const first = await analyzeNoShowPatterns(supabase, "cache-test-tenant");
    const second = await analyzeNoShowPatterns(supabase, "cache-test-tenant");

    // Same object reference — came from cache
    expect(first).toBe(second);
  });

  it("returns fresh result after cache invalidation", async () => {
    const { analyzeNoShowPatterns } = await import("../no-show-analysis");
    const supabase = makeSupabaseMock([]) as unknown as Parameters<typeof analyzeNoShowPatterns>[0];

    invalidateAnalysisCache("refresh-test-tenant");

    const first = await analyzeNoShowPatterns(supabase, "refresh-test-tenant");
    invalidateAnalysisCache("refresh-test-tenant");
    const second = await analyzeNoShowPatterns(supabase, "refresh-test-tenant");

    // Different object references — cache was busted
    expect(first).not.toBe(second);
    // But both are valid results
    expect(first.data.totalAppointments).toBe(0);
    expect(second.data.totalAppointments).toBe(0);
  });

  it("includes generatedAt timestamp in ISO 8601 format", async () => {
    const { analyzeNoShowPatterns } = await import("../no-show-analysis");
    const supabase = makeSupabaseMock([]) as unknown as Parameters<typeof analyzeNoShowPatterns>[0];

    invalidateAnalysisCache("timestamp-test-tenant");
    const result = await analyzeNoShowPatterns(supabase, "timestamp-test-tenant");

    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
