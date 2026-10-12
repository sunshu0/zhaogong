import { describe, expect, it } from "vitest";
import { hiresFromAnswer, hiresLabelZh, MAX_HIRES } from "@/components/employer/hires";

const now = Date.UTC(2026, 9, 12, 3);

describe("hiresFromAnswer", () => {
  it("records a count of people hired, with the time", () => {
    expect(hiresFromAnswer({ hired: true, count: 3 }, now)).toEqual({ ok: true, fields: { hiresConfirmed: 3, hiresConfirmedAt: "2026-10-12T03:00:00.000Z" } });
  });

  it("records 没有 / 不确定 as zero, so an answer is told apart from no answer", () => {
    expect(hiresFromAnswer({ hired: false }, now)).toEqual({ ok: true, fields: { hiresConfirmed: 0, hiresConfirmedAt: "2026-10-12T03:00:00.000Z" } });
  });

  it("records nothing when the question is skipped", () => {
    expect(hiresFromAnswer(undefined, now)).toEqual({ ok: true, fields: {} });
    expect(hiresFromAnswer(null, now)).toEqual({ ok: true, fields: {} });
  });

  it("refuses counts outside 1–20 and anything that is not a whole number", () => {
    for (const count of [0, MAX_HIRES + 1, 2.5, Number.NaN, "3"]) {
      expect(hiresFromAnswer({ hired: true, count } as never, now), String(count)).toEqual({ ok: false, error_zh: `人数请填 1 到 ${MAX_HIRES}。` });
    }
    expect(hiresFromAnswer("yes" as never, now).ok).toBe(false);
  });
});

describe("hiresLabelZh", () => {
  it("says how many were hired, that none were, or nothing when unanswered", () => {
    expect(hiresLabelZh({ hiresConfirmed: 2 })).toBe("已招到 2 人");
    expect(hiresLabelZh({ hiresConfirmed: 0 })).toBe("没有通过找工招到人");
    expect(hiresLabelZh({})).toBeUndefined();
  });
});
