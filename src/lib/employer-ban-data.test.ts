import { describe, expect, it } from "vitest";
import { DEFAULT_COUNTRY } from "@/config/countries";
import {
  banEmployer,
  getEmployer,
  getJob,
  listJobs,
  listTempBannedEmployers,
  liftTempBan,
  makeBanPermanent,
  tempBanEmployer,
} from "@/lib/data";
import { isOpenJob } from "@/lib/job-expiry";

// Temporary bans in the database (ADR 0044), on the demo data each test file gets.
const DAY = 86_400_000;
const list = (now: number) => listJobs({ country: DEFAULT_COUNTRY }, now);

/** Businesses with open jobs now, each with its job ids, most jobs first. */
async function hiring(now: number): Promise<[string, string[]][]> {
  const by = new Map<string, string[]>();
  for (const j of await list(now)) by.set(j.employerId, [...(by.get(j.employerId) ?? []), j.id]);
  return [...by].sort((a, b) => b[1].length - a[1].length);
}

describe("temporary employer bans (ADR 0044)", () => {
  it("hides the business's jobs while it lasts, takes nothing down, and shows them again once it is over", async () => {
    const now = Date.now();
    const [[id, jobs]] = await hiring(now);
    const banned = await tempBanEmployer(id, 3, "押金", now);
    expect(banned).toMatchObject({ bannedUntil: new Date(now + 3 * DAY).toISOString(), banReason: "押金" });

    expect((await list(now)).filter((j) => j.employerId === id)).toEqual([]);
    for (const jobId of jobs) expect((await getJob(jobId))?.status).toBe("active");

    const after = now + 3 * DAY;
    const back = (await list(after)).filter((j) => j.employerId === id).map((j) => j.id);
    const stillOpen = [];
    for (const jobId of jobs) if (isOpenJob((await getJob(jobId))!, after)) stillOpen.push(jobId);
    expect(back.sort()).toEqual(stillOpen.sort());

    expect((await listTempBannedEmployers(now)).map((e) => e.id)).toContain(id);
    expect((await listTempBannedEmployers(after)).map((e) => e.id)).not.toContain(id);
    expect(await liftTempBan(id, now)).toBe(true);
  });

  it("lifts early once, and only a temporary ban that is running", async () => {
    const now = Date.now();
    const [, [id]] = await hiring(now);
    await tempBanEmployer(id, 7, "态度恶劣", now);
    expect(await liftTempBan(id, now)).toBe(true);
    expect(await getEmployer(id)).not.toHaveProperty("bannedAt");
    expect((await list(now)).some((j) => j.employerId === id)).toBe(true);
    expect(await liftTempBan(id, now)).toBe(false);
  });

  it("made permanent, the jobs come down; a permanent ban is neither lifted nor shortened", async () => {
    const now = Date.now();
    const [, , [id, jobs]] = await hiring(now);
    await tempBanEmployer(id, 30, "骗人", now);
    const takenDown = await makeBanPermanent(id, now);
    expect(takenDown?.sort()).toEqual(expect.arrayContaining(jobs.sort()));
    for (const jobId of jobs) expect((await getJob(jobId))?.status).toBe("removed");
    const employer = await getEmployer(id);
    expect(employer?.bannedAt).toBeDefined();
    expect(employer).not.toHaveProperty("bannedUntil");

    expect(await makeBanPermanent(id, now)).toBeUndefined();
    expect(await liftTempBan(id, now)).toBe(false);
    expect(await tempBanEmployer(id, 3, "x", now)).toBeUndefined();
  });

  it("a permanent ban over a temporary one ends the temporary one", async () => {
    const now = Date.now();
    const [, , , [id]] = await hiring(now);
    await tempBanEmployer(id, 3, "押金", now);
    await banEmployer(id);
    const employer = await getEmployer(id);
    expect(employer?.bannedAt).toBeDefined();
    expect(employer).not.toHaveProperty("bannedUntil");
    expect(employer).not.toHaveProperty("banReason");
  });
});
