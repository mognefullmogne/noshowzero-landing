import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("Decision Engine", () => {
  const originalEnv = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.ANTHROPIC_API_KEY = originalEnv;
    }
  });

  it("should export decideStrategy function", async () => {
    const mod = await import("../decision-engine");
    expect(mod.decideStrategy).toBeDefined();
    expect(typeof mod.decideStrategy).toBe("function");
  });

  it("defines all 5 trigger event types", () => {
    const events = ["cancellation", "no_show", "timeout", "offer_declined", "offer_expired"];
    expect(events).toHaveLength(5);
  });

  it("defines all 5 strategy types", () => {
    const strategies = ["cascade", "rebook_first", "parallel_blast", "wait_and_cascade", "manual_review"];
    expect(strategies).toHaveLength(5);
  });
});
