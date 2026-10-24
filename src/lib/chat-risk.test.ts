import { describe, expect, it } from "vitest";
import { CHAT_RISK_KEEP_DAYS, chatRiskRules, keptFrom, opensItem } from "@/lib/chat-risk";

const now = new Date("2026-10-24T09:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

describe("聊天风险 (#384, ADR 0039)", () => {
  it("names the kinds of rule a message hits, in rule order", () => {
    expect(chatRiskRules("只招华人，先交押金，在家刷单")).toEqual(["fee", "task_scam", "ethnic_preference"]);
    expect(chatRiskRules("我们不收押金")).toEqual([]);
  });

  it("opens an item at three within seven days, not two, and not with older ones", () => {
    expect(opensItem([daysAgo(1), daysAgo(2)], null, now)).toBe(false);
    expect(opensItem([daysAgo(1), daysAgo(2), daysAgo(6.9)], null, now)).toBe(true);
    expect(opensItem([daysAgo(1), daysAgo(2), daysAgo(7.1)], null, now)).toBe(false);
  });

  it("after an item was closed, counts only what came after", () => {
    const closed = daysAgo(1.5);
    expect(opensItem([daysAgo(1), daysAgo(2), daysAgo(3)], closed, now)).toBe(false);
    expect(opensItem([daysAgo(0.1), daysAgo(0.5), daysAgo(1), daysAgo(2)], closed, now)).toBe(true);
  });

  it("keeps records for 90 days", () => {
    expect(CHAT_RISK_KEEP_DAYS).toBe(90);
    expect(keptFrom(now)).toBe(daysAgo(90));
  });
});
