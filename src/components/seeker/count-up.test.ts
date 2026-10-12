import { describe, expect, it } from "vitest";
import { COUNT_UP_MS, countAt, easeOutCubic, STAGGER_MS, totalCountUpMs } from "@/components/seeker/count-up";

describe("easeOutCubic", () => {
  it("starts at 0, ends at 1 and never goes back", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    let last = 0;
    for (let i = 1; i <= 100; i++) {
      const v = easeOutCubic(i / 100);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });

  it("is fast first, slow at the end", () => {
    expect(easeOutCubic(0.25)).toBeGreaterThan(0.5);
    expect(easeOutCubic(0.9) - easeOutCubic(0.8)).toBeLessThan(easeOutCubic(0.2) - easeOutCubic(0.1));
  });

  it("clamps times outside 0–1", () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });
});

describe("countAt", () => {
  it("counts whole numbers from 0 to the target over the duration", () => {
    expect(countAt(43, 0)).toBe(0);
    expect(countAt(43, COUNT_UP_MS)).toBe(43);
    expect(countAt(43, COUNT_UP_MS * 10)).toBe(43);
    for (let t = 0; t <= COUNT_UP_MS; t += 16) {
      const v = countAt(43, t);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(43);
    }
  });

  it("waits for its stagger before moving", () => {
    expect(countAt(19, STAGGER_MS * 3, 3)).toBe(0);
    expect(countAt(19, STAGGER_MS * 3 + COUNT_UP_MS, 3)).toBe(19);
  });

  it("keeps 0 at 0", () => {
    expect(countAt(0, COUNT_UP_MS / 2)).toBe(0);
  });
});

describe("timing", () => {
  it("lasts 1.2–1.6 s with a stagger of at most 100 ms across four numbers", () => {
    expect(COUNT_UP_MS).toBeGreaterThanOrEqual(1200);
    expect(COUNT_UP_MS).toBeLessThanOrEqual(1600);
    expect(STAGGER_MS * 3).toBeLessThanOrEqual(100);
    expect(totalCountUpMs(4)).toBe(COUNT_UP_MS + STAGGER_MS * 3);
  });
});
