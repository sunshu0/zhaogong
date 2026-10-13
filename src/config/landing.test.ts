import { describe, expect, it } from "vitest";
import { DEMO_DATA, STAT_MIN_TO_SHOW, visibleStats } from "@/config/landing";

describe("landing stats", () => {
  const stats = { employersPosting: 8, jobsPosted: 19, hiresConfirmed: 5, contactViews: 43 };

  it("lists the stats in display order with their labels", () => {
    const shown = visibleStats(stats);
    if (DEMO_DATA)
      expect(shown.map((s) => s.key)).toEqual(["employersPosting", "jobsPosted", "hiresConfirmed", "contactViews"]);
    for (const s of shown) expect(s.value).toBe(stats[s.key]);
  });

  it("thresholds are positive, so real numbers below them are hidden once demo data is off", () => {
    for (const n of Object.values(STAT_MIN_TO_SHOW)) expect(n).toBeGreaterThan(0);
  });
});
