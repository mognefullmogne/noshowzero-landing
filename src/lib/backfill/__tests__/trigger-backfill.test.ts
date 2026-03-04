import { describe, it } from "vitest";

describe("triggerBackfill", () => {
  it.todo("fetches cancelled appointment and calls findCandidates");
  it.todo("passes cancellingPatientId to findCandidates for exclusion");
  it.todo("skips if appointment is not cancelled or no_show");
  it.todo("skips if active offer already exists for this slot");
  it.todo("sends offer to top-ranked candidate");
});
