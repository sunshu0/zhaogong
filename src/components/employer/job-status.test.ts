import { describe, expect, it } from "vitest";
import {
  canClose,
  canEdit,
  daysLeft,
  effectiveStatus,
  expiryLabelZh,
  canCopy,
  canRepublish,
  jobPhase,
  refreshedDates,
  refreshState,
  renewDaysLeft,
  renewState,
} from "@/components/employer/job-status";
import type { Job } from "@/lib/types";

const now = Date.UTC(2026, 9, 12, 3);
const day = 86_400_000;
const job = (status: Job["status"], expiresInDays: number) =>
  ({ status, expiresAt: new Date(now + expiresInDays * day).toISOString() }) as Pick<Job, "status" | "expiresAt">;

describe("effectiveStatus", () => {
  it("treats an active job past its expiry as expired", () => {
    expect(effectiveStatus(job("active", 3), now)).toBe("active");
    expect(effectiveStatus(job("active", -0.1), now)).toBe("expired");
  });

  it("keeps every other status as it is", () => {
    expect(effectiveStatus(job("pending_review", -5), now)).toBe("pending_review");
    expect(effectiveStatus(job("removed", 10), now)).toBe("removed");
  });
});

describe("daysLeft and expiryLabelZh", () => {
  it("rounds part days up and never goes below zero", () => {
    expect(daysLeft(job("active", 29.2), now)).toBe(30);
    expect(daysLeft(job("active", 0.5), now)).toBe(1);
    expect(daysLeft(job("active", -2), now)).toBe(0);
  });

  it("says how long is left, or what happened", () => {
    expect(expiryLabelZh(job("active", 12), now)).toBe("12 天后截止");
    expect(expiryLabelZh(job("active", 0.3), now)).toBe("今天截止");
    expect(expiryLabelZh(job("active", -1), now)).toBe("还可以续期 13 天");
    expect(expiryLabelZh(job("expired", -20), now)).toBe("已不能续期");
    expect(expiryLabelZh(job("removed", 5), now)).toBe("已下架");
    expect(expiryLabelZh(job("pending_review", 30), now)).toBe("审核通过后开始计算 30 天");
  });
});

describe("what an employer can do with a job", () => {
  const dated = (status: Job["status"], postedDaysAgo: number, expiresInDays: number) => ({
    status,
    postedAt: new Date(now - postedDaysAgo * day).toISOString(),
    expiresAt: new Date(now + expiresInDays * day).toISOString(),
  });

  it("refreshes a live job at most once a day; an ended job is renewed instead (#69)", () => {
    expect(refreshState(dated("active", 3, 27), now)).toEqual({ allowed: true });
    expect(refreshState(dated("active", 0.5, 29.5), now)).toEqual({ allowed: false, reason_zh: "今天已刷新过" });
    expect(refreshState(dated("active", 31, -1), now)).toEqual({ allowed: false, reason_zh: "已截止，不能刷新" });
    expect(refreshState(dated("expired", 0.2, 0), now).allowed).toBe(false);
  });

  it("does not refresh jobs under review or taken down", () => {
    expect(refreshState(dated("pending_review", 3, 27), now).allowed).toBe(false);
    expect(refreshState(dated("removed", 3, 27), now).allowed).toBe(false);
  });

  it("closes live or waiting jobs and edits anything moderation has not taken down", () => {
    expect(canClose(dated("active", 1, 29), now)).toBe(true);
    expect(canClose(dated("pending_review", 1, 29), now)).toBe(true);
    expect(canClose(dated("active", 31, -1), now)).toBe(false);
    expect(canEdit({ status: "expired" })).toBe(true);
    expect(canEdit({ status: "removed" })).toBe(false);
  });

  it("gives a refreshed job 30 more days from now", () => {
    expect(refreshedDates(now)).toEqual({
      postedAt: "2026-10-12T03:00:00.000Z",
      expiresAt: "2026-11-11T03:00:00.000Z",
    });
  });

  it("keeps a later closing date when refreshing a renewed job", () => {
    expect(refreshedDates(now, "2026-12-01T00:00:00.000Z").expiresAt).toBe("2026-12-01T00:00:00.000Z");
    expect(refreshedDates(now, "2026-10-20T00:00:00.000Z").expiresAt).toBe("2026-11-11T03:00:00.000Z");
  });
});

describe("closing soon, renewing and publishing again (#69)", () => {
  it("puts each job in one phase", () => {
    expect(jobPhase(job("active", 3.5), now)).toBe("active");
    expect(jobPhase(job("active", 3), now)).toBe("ending");
    expect(jobPhase(job("active", 0.1), now)).toBe("ending");
    expect(jobPhase(job("active", -0.1), now)).toBe("timed_out");
    expect(jobPhase(job("expired", 5), now)).toBe("closed");
    expect(jobPhase(job("pending_review", -5), now)).toBe("pending_review");
    expect(jobPhase(job("removed", 5), now)).toBe("removed");
  });

  it("renews a live job by pushing its closing date back, not from today", () => {
    const state = renewState(job("active", 2), now);
    expect(state.allowed).toBe(true);
    if (!state.allowed) return;
    expect(state.choices).toEqual([
      { days: 14, expiresAt: new Date(now + 16 * day).toISOString(), allowed: true },
      { days: 30, expiresAt: new Date(now + 32 * day).toISOString(), allowed: true },
      { days: 60, expiresAt: new Date(now + 62 * day).toISOString(), allowed: true },
    ]);
  });

  it("renews an ended job from today, for 14 days after it closed", () => {
    const state = renewState(job("active", -13.5), now);
    expect(state.allowed && state.choices[1].expiresAt).toBe(new Date(now + 30 * day).toISOString());
    expect(renewDaysLeft(job("active", -13.5), now)).toBe(1);
    expect(renewState(job("expired", -2), now).allowed).toBe(true); // ended by the employer
    expect(renewState(job("active", -14.1), now)).toEqual({
      allowed: false,
      reason_zh: "截止超过 14 天，不能续期",
      republish: true,
    });
  });

  it("never lets a job close more than 90 days from now", () => {
    const state = renewState(job("active", 40), now);
    expect(state.allowed && state.choices.map((c) => c.allowed)).toEqual([true, true, false]);
    expect(renewState(job("active", 80), now)).toEqual({
      allowed: false,
      reason_zh: "截止日最远到 90 天后，现在不用续期",
    });
  });

  it("does not renew jobs under review or taken down", () => {
    expect(renewState(job("pending_review", 30), now)).toEqual({ allowed: false, reason_zh: "审核通过后才能续期" });
    expect(renewState(job("removed", -1), now)).toEqual({ allowed: false, reason_zh: "已被下架" });
  });

  it("publishes again only what can no longer be renewed", () => {
    expect(canRepublish(job("active", -20), now)).toBe(true);
    expect(canRepublish(job("expired", -15), now)).toBe(true);
    expect(canRepublish(job("active", -3), now)).toBe(false);
    expect(canRepublish(job("active", 10), now)).toBe(false);
    expect(canRepublish(job("removed", -30), now)).toBe(false);
  });

  it("copies a live or ended job, not one taken down or under review (#190)", () => {
    expect(canCopy(job("active", 10))).toBe(true);
    expect(canCopy(job("expired", -30))).toBe(true);
    expect(canCopy(job("removed", -1))).toBe(false);
    expect(canCopy(job("pending_review", 30))).toBe(false);
  });
});
