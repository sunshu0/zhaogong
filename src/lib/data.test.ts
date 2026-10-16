import { describe, expect, it } from "vitest";
import { demoShowcase } from "@/db/demo-showcase";
import { isOpenJob } from "@/lib/job-expiry";
import { createJob, getJob, listFeaturedJobs, listJobs, matchesFilter, updateJob } from "@/lib/data";
import type { Job } from "@/lib/types";
import { MOCK_EMPLOYERS, MOCK_JOBS } from "@/mock/data";

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
    // The demo's own jobs, and those added to show the newer features (#88) that are open now.
    const showcase = demoShowcase(Date.now()).jobs.filter((j) => isOpenJob(j, Date.now()));
    expect(jobs.length).toBe(MOCK_JOBS.filter((j) => j.status === "active").length + showcase.length);
    for (let i = 1; i < jobs.length; i++) {
      expect(jobs[i - 1].postedAt.slice(0, 10) >= jobs[i].postedAt.slice(0, 10)).toBe(true);
    }
  });

  it("filters by visa, industry and minimum pay", async () => {
    const jobs = await listJobs({ country: "NZ", visa: "student", industries: ["hospitality"], minPay: 25 });
    expect(jobs.map((j) => j.id).sort()).toEqual(["j1", "j20"]); // j20: 川味小馆's, from #88
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
    expect(r.handledAt).toBeUndefined();
    await updateReport(r.id, "actioned", new Date("2026-10-16T01:00:00.000Z"));
    expect((await listReports()).find((x) => x.id === r.id)).toMatchObject({
      status: "actioned",
      handledAt: "2026-10-16T01:00:00.000Z", // when it was closed (#70)
    });
    expect((await updateReport(r.id, "open"))?.handledAt).toBeUndefined();
  });
});

describe("moderation log", () => {
  it("keeps decisions newest first", async () => {
    const { addModerationLog, listModerationLog } = await import("@/lib/data");
    await addModerationLog({ action: "take_down", jobId: "j2", reasons: ["charges_fee"], moderator: "m@example.com" });
    await addModerationLog({ action: "ban", employerId: "e6", takenDown: 1, moderator: "m@example.com" });
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
    expect(a).toEqual(b); // the same stored account (a fresh copy per read since B12-1)
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

  it("lists the businesses some account has bound, and only those", async () => {
    const { createEmployer, openEmployerIdentity, listClaimedEmployerIds } = await import("@/lib/data");
    const bound = await createEmployer({ name: "已绑定的店", regionId: "akl-cbd" });
    const free = await createEmployer({ name: "没人绑定的店", regionId: "akl-cbd" });
    await openEmployerIdentity("claimer@example.com", bound.id);
    const ids = await listClaimedEmployerIds();
    expect(ids).toContain(bound.id);
    expect(ids).not.toContain(free.id);
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
    // An older draft: one employment type and no contact choice.
    const legacy: Record<string, unknown> = { ...MOCK_JOBS[1], employmentType: "casual" };
    delete legacy.id;
    delete legacy.contactPublic;
    const created = await createJob(legacy as unknown as Omit<Job, "id">);
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

describe("on the database", () => {
  it("gives new records the next id of their kind, as the demo data has", async () => {
    const { createEmployer, submitReport, addModerationLog } = await import("@/lib/data");
    const employer = await createEmployer({ name: "新店", regionId: "akl-cbd" });
    expect(employer.id).toMatch(/^e\d+$/);
    expect(Number(employer.id.slice(1))).toBeGreaterThan(MOCK_EMPLOYERS.length);
    const job: Partial<Job> = { ...MOCK_JOBS[0] };
    delete job.id;
    const a = await createJob(job as Omit<Job, "id">);
    const b = await createJob(job as Omit<Job, "id">);
    expect(Number(b.id.slice(1))).toBe(Number(a.id.slice(1)) + 1);
    const report = await submitReport(a.id, "other");
    expect(report.id).toMatch(/^r\d+$/);
    expect((await addModerationLog({ action: "dismiss", jobId: a.id, moderator: "m@example.com" })).id).toMatch(
      /^a\d+$/,
    );
  });

  it("loads the demo data once, however often the database is asked for", async () => {
    const { database } = await import("@/db/ready");
    const { listEmployers } = await import("@/lib/data");
    await Promise.all([database(), database(), database()]);
    const ids = (await listEmployers()).map((e) => e.id);
    for (const demo of MOCK_EMPLOYERS) expect(ids.filter((id) => id === demo.id)).toHaveLength(1);
  });

  it("wants demo data in development and tests, and only when asked in production", async () => {
    const { demoDataWanted } = await import("@/db/ready");
    const env = process.env as Record<string, string | undefined>;
    const saved = { NODE_ENV: env.NODE_ENV, DEMO_DATA: env.DEMO_DATA };
    try {
      delete env.DEMO_DATA;
      env.NODE_ENV = "production";
      expect(demoDataWanted()).toBe(false);
      env.DEMO_DATA = "true";
      expect(demoDataWanted()).toBe(true);
      env.NODE_ENV = "development";
      env.DEMO_DATA = "false";
      expect(demoDataWanted()).toBe(false);
      delete env.DEMO_DATA;
      expect(demoDataWanted()).toBe(true);
    } finally {
      Object.assign(env, saved);
    }
  });
});

describe("closed jobs leave the lists when read (R-32, ADR 0008)", () => {
  it("a job past its closing date is not listed, though its status is still active", async () => {
    const base = { ...MOCK_JOBS[0], employerId: "e1", pay: { min: 99 } };
    const past = await createJob({ ...base, titleZh: "已过截止日期的职位", expiresAt: "2020-01-01T00:00:00.000Z" });
    const open = await createJob({ ...base, titleZh: "还在招的职位", expiresAt: "2099-01-01T00:00:00.000Z" });
    expect((await getJob(past.id))?.status).toBe("active");

    const listed = (await listJobs({ country: "NZ" })).map((j) => j.id);
    expect(listed).toContain(open.id);
    expect(listed).not.toContain(past.id);
    const featured = (await listFeaturedJobs("NZ", 50, Date.now())).map((j) => j.id);
    expect(featured).toContain(open.id);
    expect(featured).not.toContain(past.id);
  });
});
