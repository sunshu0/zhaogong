import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { database } from "@/db/ready";
import { reports } from "@/db/schema";
import { hasOpenReport, isOpenReportClash, submitReport, updateReport } from "@/lib/data";

// Security review C (ADR 0034), the database half: one open report per person and job is the unique index
// reports_open_reporter_uq (migration 0033), on libSQL and on D1 (npm run test:d1) alike.
const alice = "a".repeat(64);
const bob = "b".repeat(64);
const reporterOf = async (id: string) =>
  (await (await database()).select().from(reports).where(eq(reports.id, id)))[0]?.reporter;

describe("one open report per person and job", () => {
  it("refuses the same person's second open report on a job, as a clash the action can tell apart", async () => {
    const first = await submitReport("j3", "fake_job", undefined, undefined, alice);
    expect(await hasOpenReport("j3", alice)).toBe(true);
    expect(await hasOpenReport("j3", bob)).toBe(false);
    const error = await submitReport("j3", "other", "again", undefined, alice).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(isOpenReportClash(error)).toBe(true);
    expect(isOpenReportClash(new Error("UNIQUE constraint failed: moderators.email"))).toBe(false);
    // Others, other jobs and reports without a reporter are not held back.
    await submitReport("j3", "fake_job", undefined, undefined, bob);
    await submitReport("j4", "fake_job", undefined, undefined, alice);
    await submitReport("j3", "fake_job");
    await submitReport("j3", "fake_job");

    // Handled: the hash goes, and the person may report the job again.
    await updateReport(first.id, "actioned");
    expect(await reporterOf(first.id)).toBeNull();
    expect(await hasOpenReport("j3", alice)).toBe(false);
    const again = await submitReport("j3", "fake_job", undefined, undefined, alice);
    expect(await reporterOf(again.id)).toBe(alice);
  });

  it("lets one of two sent at once in", async () => {
    const results = await Promise.allSettled([
      submitReport("j5", "fake_job", undefined, undefined, alice),
      submitReport("j5", "other", "twice", undefined, alice),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(isOpenReportClash(failed.reason)).toBe(true);
  });
});
