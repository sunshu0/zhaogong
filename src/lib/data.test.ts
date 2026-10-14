import { describe, expect, it } from "vitest";
import { createJob, getJob, listJobs, matchesFilter, updateJob } from "@/lib/data";
import type { Job } from "@/lib/types";
import { MOCK_JOBS } from "@/mock/data";

describe("job filter", () => {
  it("matches any type accepted by a multi-type job", () => {
    const job = { ...MOCK_JOBS[0], employmentType: ["full_time", "part_time"] as const };
    for (const type of ["full_time", "part_time"] as const)
      expect(
        matchesFilter({ ...job, employmentType: [...job.employmentType] }, { country: "NZ", employmentTypes: [type] }),
      ).toBe(true);
    expect(
      matchesFilter(
        { ...job, employmentType: [...job.employmentType] },
        { country: "NZ", employmentTypes: ["casual"] },
      ),
    ).toBe(false);
  });
  it("lists only active NZ jobs, newest first", async () => {
    const jobs = await listJobs({ country: "NZ" });
    expect(jobs.length).toBe(MOCK_JOBS.filter((j) => j.status === "active").length);
    for (let i = 1; i < jobs.length; i++) {
      expect(jobs[i - 1].postedAt.slice(0, 10) >= jobs[i].postedAt.slice(0, 10)).toBe(true);
    }
  });

  it("filters by visa, industry and minimum pay", async () => {
    const jobs = await listJobs({ country: "NZ", visa: "student", industries: ["hospitality"], minPay: 25 });
    expect(jobs.map((j) => j.id).sort()).toEqual(["j1"]);
  });

  it("matches the query in either language", () => {
    const job = MOCK_JOBS.find((j) => j.id === "j3")!;
    expect(matchesFilter(job, { country: "NZ", query: "点心" })).toBe(true);
    expect(matchesFilter(job, { country: "NZ", query: "dim sum" })).toBe(true);
    expect(matchesFilter(job, { country: "NZ", query: "叉车" })).toBe(false);
  });

  it("ignores markets that are not opened", async () => {
    expect(await listJobs({ country: "AU" })).toEqual([]);
  });
});

describe("employer and moderation data", () => {
  it("updates a job and lists it whatever its status", async () => {
    const { listAllJobs, updateJob, getJob } = await import("@/lib/data");
    await updateJob("j9", { status: "expired" });
    expect((await getJob("j9"))?.status).toBe("expired");
    expect((await listAllJobs("NZ")).some((j) => j.id === "j9")).toBe(true);
    expect((await listJobs({ country: "NZ" })).some((j) => j.id === "j9")).toBe(false);
    expect(await updateJob("nope", { status: "active" })).toBeUndefined();
  });

  it("bans an employer and takes down their jobs", async () => {
    const { banEmployer, getEmployer, listJobsByEmployer } = await import("@/lib/data");
    const removed = await banEmployer("e6");
    expect(removed).toEqual(["j10"]);
    expect((await getEmployer("e6"))?.bannedAt).toBeDefined();
    expect((await listJobsByEmployer("e6")).every((j) => j.status === "removed")).toBe(true);
  });

  it("sets verification without touching the demo data", async () => {
    const { setEmployerVerification, getEmployer } = await import("@/lib/data");
    const { MOCK_EMPLOYERS } = await import("@/mock/data");
    await setEmployerVerification("e4", "business_verified", {
      legalName: "Demo Yuemei Limited",
      businessNumber: "9429000000004",
    });
    expect((await getEmployer("e4"))?.verification).toBe("business_verified");
    expect(MOCK_EMPLOYERS.find((e) => e.id === "e4")?.verification).toBe("unverified");
  });

  it("records contact views and updates reports", async () => {
    const { recordContactView, listContactViews, submitReport, updateReport, listReports } = await import("@/lib/data");
    const before = (await listContactViews("j1")).length;
    await recordContactView("j1", "a@example.com");
    await recordContactView("j1", "b@example.com");
    expect((await listContactViews("j1")).length).toBe(before + 2);
    const r = await submitReport("j2", "charges_fee");
    await updateReport(r.id, "actioned");
    expect((await listReports()).find((x) => x.id === r.id)?.status).toBe("actioned");
  });
});

describe("moderation log", () => {
  it("keeps decisions newest first", async () => {
    const { addModerationLog, listModerationLog } = await import("@/lib/data");
    await addModerationLog({ action: "take_down", jobId: "j2", reasons: ["charges_fee"] });
    await addModerationLog({ action: "ban", employerId: "e6", takenDown: 1 });
    const log = await listModerationLog();
    expect(log.map((e) => e.action).slice(0, 2)).toEqual(["ban", "take_down"]);
    expect(log[0].id).not.toBe(log[1].id);
  });
});

describe("landing page data", () => {
  it("counts posting employers, jobs, confirmed hires and contact views", async () => {
    const { getPlatformStats } = await import("@/lib/data");
    const stats = await getPlatformStats("NZ");
    expect(stats.hiresConfirmed).toBeGreaterThanOrEqual(5);
    expect(stats.jobsPosted).toBeGreaterThan(0);
    expect(stats.employersPosting).toBeLessThanOrEqual(stats.jobsPosted);
    expect(stats.contactViews).toBeGreaterThan(0);
    expect(await getPlatformStats("AU")).toEqual({
      employersPosting: 0,
      jobsPosted: 0,
      hiresConfirmed: 0,
      contactViews: 0,
    });
  });

  it("features only active jobs from verified, not banned employers, best pay first", async () => {
    const { listFeaturedJobs, getEmployer } = await import("@/lib/data");
    const featured = await listFeaturedJobs("NZ", 4);
    expect(featured.length).toBe(4);
    for (const j of featured) {
      expect(j.status).toBe("active");
      const e = await getEmployer(j.employerId);
      expect(e?.verification).not.toBe("unverified");
      expect(e?.bannedAt).toBeUndefined();
    }
    const top = (j: (typeof featured)[number]) => j.pay.max ?? j.pay.min;
    for (let i = 1; i < featured.length; i++) expect(top(featured[i - 1])).toBeGreaterThanOrEqual(top(featured[i]));
  });
});

describe("accounts and the employer identity", () => {
  it("creates one account per email, whatever the case or spaces", async () => {
    const { ensureAccount, getAccount } = await import("@/lib/data");
    const a = await ensureAccount("  Mei@Example.com ");
    const b = await ensureAccount("mei@example.com");
    expect(a).toBe(b);
    expect((await getAccount("MEI@example.com"))?.employerId).toBeUndefined();
  });

  it("opens the employer identity for a new business and finds it again", async () => {
    const { createEmployer, openEmployerIdentity, getAccountEmployer } = await import("@/lib/data");
    const shop = await createEmployer({ name: " 新店 ", regionId: "akl-cbd" });
    expect(shop).toMatchObject({ name: "新店", verification: "unverified" });
    const opened = await openEmployerIdentity("boss@example.com", shop.id);
    expect(opened.ok).toBe(true);
    expect((await getAccountEmployer("BOSS@example.com"))?.id).toBe(shop.id);
  });

  it("refuses a second business, a business someone else holds, a banned or unknown one", async () => {
    const { createEmployer, openEmployerIdentity, banEmployer } = await import("@/lib/data");
    const one = await createEmployer({ name: "一号店", regionId: "akl-cbd" });
    const two = await createEmployer({ name: "二号店", regionId: "akl-cbd" });
    expect((await openEmployerIdentity("owner1@example.com", one.id)).ok).toBe(true);
    expect(await openEmployerIdentity("owner1@example.com", two.id)).toEqual({ ok: false, reason: "already_employer" });
    expect(await openEmployerIdentity("owner2@example.com", one.id)).toEqual({ ok: false, reason: "taken" });
    await banEmployer(two.id);
    expect(await openEmployerIdentity("owner3@example.com", two.id)).toEqual({ ok: false, reason: "banned" });
    expect(await openEmployerIdentity("owner3@example.com", "nope")).toEqual({ ok: false, reason: "no_employer" });
  });

  it("stops posting for a business once it is banned", async () => {
    const { createEmployer, openEmployerIdentity, banEmployer, getAccountEmployer } = await import("@/lib/data");
    const shop = await createEmployer({ name: "将被封的店", regionId: "akl-cbd" });
    await openEmployerIdentity("owner4@example.com", shop.id);
    await banEmployer(shop.id);
    expect(await getAccountEmployer("owner4@example.com")).toBeUndefined();
  });
});

describe("job shape", () => {
  it("stores employment types as a list and contact details as private by default", async () => {
    const { id: _id, contactPublic: _public, ...rest } = MOCK_JOBS[1];
    const legacy = { ...rest, employmentType: "casual" } as unknown as Omit<Job, "id">;
    const created = await createJob(legacy);
    expect(created.employmentType).toEqual(["casual"]);
    expect(created.contactPublic).toBe(false);

    await updateJob(created.id, { employmentType: ["casual", "full_time"] });
    expect((await getJob(created.id))?.employmentType).toEqual(["full_time", "casual"]);
    expect((await getJob(created.id))?.contactPublic).toBe(false);
  });

  it("has a few demo jobs with public contact details and none hidden on the others", () => {
    const shown = MOCK_JOBS.filter((j) => j.contactPublic);
    expect(shown.length).toBeGreaterThanOrEqual(2);
    expect(shown.length).toBeLessThanOrEqual(3);
    for (const job of shown) expect(Object.values(job.contact).some(Boolean)).toBe(true);
    for (const job of MOCK_JOBS.filter((j) => !j.contactPublic)) expect(job.contact).toEqual({});
  });
});
