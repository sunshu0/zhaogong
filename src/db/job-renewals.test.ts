import { describe, expect, it } from "vitest";
import { listRenewals, renewalCounts, renewJob } from "@/db/job-renewals";
import { createJob, getJob } from "@/lib/data";
import type { Job } from "@/lib/types";
import { MOCK_JOBS } from "@/mock/data";

async function newJob(patch: Partial<Job> = {}): Promise<string> {
  const job: Partial<Job> = { ...MOCK_JOBS[0], ...patch };
  delete job.id;
  return (await createJob(job as Omit<Job, "id">)).id;
}

const t0 = new Date("2026-10-16T01:00:00.000Z");

describe("renewals (#69)", () => {
  it("moves the closing date and records the renewal with the dates before and after", async () => {
    const id = await newJob({ status: "active", expiresAt: "2026-10-18T00:00:00.000Z" });
    const job = await renewJob(id, { expiresAt: "2026-11-17T00:00:00.000Z", status: "active", days: 30 }, t0);
    expect(job).toMatchObject({ id, status: "active", expiresAt: "2026-11-17T00:00:00.000Z" });
    expect((await getJob(id))?.expiresAt).toBe("2026-11-17T00:00:00.000Z");
    expect(await listRenewals([id])).toEqual([
      {
        jobId: id,
        renewedAt: t0.toISOString(),
        days: 30,
        expiresBefore: "2026-10-18T00:00:00.000Z",
        expiresAfter: "2026-11-17T00:00:00.000Z",
      },
    ]);
  });

  it("reopens an ended job with the status it is given", async () => {
    const id = await newJob({ status: "expired", expiresAt: "2026-10-10T00:00:00.000Z" });
    const job = await renewJob(id, { expiresAt: "2026-10-30T00:00:00.000Z", status: "pending_review", days: 14 }, t0);
    expect(job?.status).toBe("pending_review");
  });

  it("counts renewals per job, with the last time", async () => {
    const a = await newJob();
    const b = await newJob();
    const never = await newJob();
    await renewJob(a, { expiresAt: "2026-11-01T00:00:00.000Z", status: "active", days: 14 }, t0);
    await renewJob(
      a,
      { expiresAt: "2026-12-01T00:00:00.000Z", status: "active", days: 30 },
      new Date("2026-10-20T00:00:00Z"),
    );
    await renewJob(b, { expiresAt: "2026-11-01T00:00:00.000Z", status: "active", days: 14 }, t0);
    expect(await renewalCounts([a, b, never])).toEqual({
      [a]: { count: 2, lastAt: "2026-10-20T00:00:00.000Z" },
      [b]: { count: 1, lastAt: t0.toISOString() },
    });
    expect(await renewalCounts([])).toEqual({});
  });

  it("changes nothing for a job that does not exist", async () => {
    expect(await renewJob("no-such-job", { expiresAt: t0.toISOString(), status: "active", days: 14 }, t0)).toBe(
      undefined,
    );
    expect(await listRenewals(["no-such-job"])).toEqual([]);
  });
});
