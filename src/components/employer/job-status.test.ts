import { describe, expect, it } from "vitest";
import { daysLeft, effectiveStatus, expiryLabelZh } from "@/components/employer/job-status";
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
    expect(expiryLabelZh(job("active", -1), now)).toBe("已过期");
    expect(expiryLabelZh(job("removed", 5), now)).toBe("已下架");
    expect(expiryLabelZh(job("pending_review", 30), now)).toBe("审核通过后开始计算 30 天");
  });
});
