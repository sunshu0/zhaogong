import { describe, expect, it } from "vitest";
import {
  canClose,
  canEdit,
  daysLeft,
  effectiveStatus,
  expiryLabelZh,
  refreshedDates,
  refreshState,
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
    expect(expiryLabelZh(job("active", 12), now)).toBe("还有 12 天到期");
    expect(expiryLabelZh(job("active", 0.3), now)).toBe("今天到期");
    expect(expiryLabelZh(job("active", -1), now)).toBe("已结束");
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

  it("refreshes at most once a day, and reopens an ended job", () => {
    expect(refreshState(dated("active", 3, 27), now)).toEqual({ allowed: true });
    expect(refreshState(dated("active", 0.5, 29.5), now)).toEqual({ allowed: false, reason_zh: "今天已刷新过" });
    expect(refreshState(dated("active", 31, -1), now)).toEqual({ allowed: true });
    expect(refreshState(dated("expired", 0.2, 0), now)).toEqual({ allowed: true });
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
});
