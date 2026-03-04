import { describe, it } from "vitest";

describe("findCandidates", () => {
  it.todo("returns candidates from appointments table, not waitlist_entries");
  it.todo("excludes the cancelling patient from candidates");
  it.todo("excludes patients in 24hr decline cooldown");
  it.todo("excludes time-conflicting appointments");
  it.todo("only includes appointments AFTER the open slot");
  it.todo("deduplicates by patient, keeping farthest-out appointment");
  it.todo("returns empty array when slot is in the past");
  it.todo("returns empty array when no candidates found");
  it.todo("caps results at the limit parameter");
  it.todo("ranks by candidate score descending");
});
