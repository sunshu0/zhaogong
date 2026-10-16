import { describe, expect, it } from "vitest";
import { countAiCalls, listAiUsageSince, recordAiUsage } from "@/db/ai-usage";
import { AI_LIMITS, limitWindows, overLimit } from "@/lib/ai-post/model/limits";

const t0 = new Date("2026-10-17T01:00:00.000Z");
const later = (ms: number) => new Date(t0.getTime() + ms);
const TOKENS = { input: 1000, output: 200, cacheRead: 800, cacheWrite: 50 };

describe("AI 发帖 limits (#102)", () => {
  it("allows 6 calls a minute and 100 a day, the day limit said first", () => {
    expect(AI_LIMITS).toEqual({ perMinute: 6, perDay: 100 });
    expect(overLimit({ lastMinute: 5, lastDay: 99 })).toBeUndefined();
    expect(overLimit({ lastMinute: 6, lastDay: 6 })).toBe("minute");
    expect(overLimit({ lastMinute: 0, lastDay: 100 })).toBe("day");
    expect(overLimit({ lastMinute: 6, lastDay: 100 })).toBe("day");
  });

  it("counts the minute and the day back from now", () => {
    expect(limitWindows(t0)).toEqual({
      minute: new Date("2026-10-17T00:59:00.000Z"),
      day: new Date("2026-10-16T01:00:00.000Z"),
    });
  });
});

describe("ai_usage (#102)", () => {
  it("counts an account's calls in the last minute and day, not the ones turned away or anyone else's", async () => {
    const me = "counted@example.com";
    await recordAiUsage(me, { model: "m", usage: TOKENS, result: "ok" }, later(-2 * 86_400_000));
    await recordAiUsage(me, { model: "m", usage: TOKENS, result: "ok" }, later(-3_600_000));
    await recordAiUsage(" Counted@Example.com ", { model: "m", result: "error" }, later(-30_000));
    await recordAiUsage(me, { model: "m", usage: TOKENS, result: "refused" }, later(-10_000));
    await recordAiUsage(me, { model: "m", result: "limited" }, later(-5_000));
    await recordAiUsage("other@example.com", { model: "m", usage: TOKENS, result: "ok" }, later(-5_000));
    expect(await countAiCalls(me, t0)).toEqual({ lastMinute: 2, lastDay: 3 });
    expect(await countAiCalls("nobody.yet@example.com", t0)).toEqual({ lastMinute: 0, lastDay: 0 });
  });

  it("lists every call since a moment with its tokens, oldest first, without the email", async () => {
    const from = new Date("2026-10-20T00:00:00.000Z");
    await recordAiUsage("b@example.com", { model: "fake", result: "unreadable" }, new Date("2026-10-20T02:00:00.000Z"));
    await recordAiUsage("a@example.com", { model: "claude-sonnet-5-5", usage: TOKENS, result: "ok" }, from);
    const rows = await listAiUsageSince(from);
    expect(rows).toEqual([
      { at: from.toISOString(), model: "claude-sonnet-5-5", ...TOKENS, result: "ok" },
      {
        at: "2026-10-20T02:00:00.000Z",
        model: "fake",
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        result: "unreadable",
      },
    ]);
    expect(JSON.stringify(rows)).not.toContain("@example.com");
  });
});
