import { describe, expect, it } from "vitest";
import { closingReminders } from "@/components/employer/job-reminders";
import type { Job } from "@/lib/types";

const now = Date.UTC(2026, 9, 16, 3);
const day = 86_400_000;
const job = (id: string, days: number, status: Job["status"] = "active") => ({
  id,
  titleZh: id,
  status,
  expiresAt: new Date(now + days * day).toISOString(),
});

describe("closing reminders (#69)", () => {
  it("reminds from 3 days before closing, soonest first", () => {
    const reminders = closingReminders([job("厨师", 2.5), job("服务员", 0.5), job("洗碗工", 3.5)], now);
    expect(reminders.map((r) => [r.title, r.detail])).toEqual([
      ["「服务员」今天截止", "还要招人就续期，招到了就结束招聘"],
      ["「厨师」3 天后截止", "还要招人就续期，招到了就结束招聘"],
    ]);
    expect(reminders[1].since).toBe(new Date(now - 0.5 * day).toISOString());
  });

  it("keeps reminding after a job ran out while it can still be renewed, under the same id", () => {
    const before = closingReminders([job("收银", 1)], now)[0];
    const after = closingReminders([{ ...job("收银", 1) }], now + 3 * day)[0];
    expect(after).toMatchObject({
      id: before.id,
      title: "「收银」已截止",
      detail: "还可以续期 12 天，之后只能重新发布",
    });
    expect(closingReminders([job("收银", 1)], now + 16 * day)).toEqual([]);
  });

  it("starts again for the new date once a job is renewed", () => {
    const first = closingReminders([job("收银", 1)], now)[0];
    const renewed = closingReminders([job("收银", 31)], now + 29 * day)[0];
    expect(renewed.id).not.toBe(first.id);
  });

  it("leaves out jobs the employer ended, jobs under review and jobs taken down", () => {
    expect(
      closingReminders([job("a", -2, "expired"), job("b", 1, "pending_review"), job("c", 1, "removed")], now),
    ).toEqual([]);
  });
});
