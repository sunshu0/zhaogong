import { describe, expect, it } from "vitest";
import { isOpenJob } from "@/lib/job-expiry";
import type { Job } from "@/lib/types";

const job = (patch: Partial<Job>) => ({ status: "active", expiresAt: "2026-11-01T00:00:00.000Z", ...patch }) as Job;
const now = Date.parse("2026-10-16T00:00:00.000Z");

describe("isOpenJob", () => {
  it("is open while active and before its closing date", () => {
    expect(isOpenJob(job({}), now)).toBe(true);
  });

  it("closes at the closing date, without anything changing its status", () => {
    expect(isOpenJob(job({ expiresAt: "2026-10-16T00:00:00.000Z" }), now)).toBe(false);
    expect(isOpenJob(job({ expiresAt: "2026-10-15T23:59:59.000Z" }), now)).toBe(false);
  });

  it("is never open when ended, removed or waiting for review", () => {
    for (const status of ["expired", "removed", "pending_review"] as const)
      expect(isOpenJob(job({ status }), now)).toBe(false);
  });
});
