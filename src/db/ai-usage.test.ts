import { describe, expect, it } from "vitest";
import {
  countAiCalls,
  finishAiCall,
  listAiUsageOf,
  listAiUsageSince,
  recordAiUsage,
  reserveAiCall,
} from "@/db/ai-usage";
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

describe("taking a call's place before the model is asked (security review B)", () => {
  it("lets only 6 of 10 calls sent at once through, and records the others as turned away", async () => {
    const me = "at.once@example.com";
    const places = await Promise.all(Array.from({ length: 10 }, () => reserveAiCall(me, "m", t0)));
    expect(places.filter((p) => "id" in p)).toHaveLength(AI_LIMITS.perMinute);
    expect(places.filter((p) => "over" in p)).toEqual(Array(10 - AI_LIMITS.perMinute).fill({ over: "minute" }));
    const rows = await listAiUsageOf(me);
    expect(rows.filter((r) => r.result === "pending")).toHaveLength(AI_LIMITS.perMinute);
    expect(rows.filter((r) => r.result === "limited")).toHaveLength(10 - AI_LIMITS.perMinute);
    expect(await countAiCalls(me, t0)).toEqual({ lastMinute: 6, lastDay: 6 });
  });

  it("fills in the call when it ends; one left pending still counts", async () => {
    const me = "filled@example.com";
    const place = await reserveAiCall(me, "m", t0);
    if (!("id" in place)) throw new Error("no place");
    await finishAiCall(place.id, { usage: TOKENS, result: "ok" });
    await reserveAiCall(me, "m", later(1000)); // never finished
    expect((await listAiUsageOf(me)).map((r) => [r.result, r.input])).toEqual([
      ["ok", TOKENS.input],
      ["pending", 0],
    ]);
    expect(await countAiCalls(me, later(2000))).toMatchObject({ lastMinute: 2 });
  });

  it("says the day limit once 100 calls were made in 24 hours", async () => {
    const me = "whole.day@example.com";
    for (let i = 0; i < AI_LIMITS.perDay; i++)
      await recordAiUsage(me, { model: "m", usage: TOKENS, result: "ok" }, later(-i * 600_000));
    expect(await reserveAiCall(me, "m", later(60_000))).toEqual({ over: "day" });
  });
});
