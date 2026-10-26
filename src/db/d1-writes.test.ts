// The writes rewritten for D1 (ADR 0031): no interactive transactions, so each must stay atomic and safe when requests
// overlap. Runs on libSQL (npm test) and on a local D1 (npm run test:d1). Requests run at once with Promise.all; on
// libSQL the per-process queue interleaves their reads and writes (A reads, B reads, A writes, B writes), the order
// that breaks a read-then-write.
import { and, count, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { d1Binding } from "@/db/client";
import { saveEmployerPage, getEmployerPage } from "@/db/employer-profiles";
import { blockCompany, saveCompanyFeed, unblockCompany } from "@/db/external-jobs";
import { inList } from "@/db/in-list";
import { createJobAlert, listJobAlerts } from "@/db/job-alerts";
import { renewJob } from "@/db/job-renewals";
import { jobNumbers, recordChatStart } from "@/db/job-stats";
import { grantModerator, listModeratorChanges, listModerators, revokeModerator } from "@/db/moderators";
import { recordViews } from "@/db/personal-info-views";
import { database, resetDatabaseForTests } from "@/db/ready";
import { saveResumeShare } from "@/db/resume-shares";
import { saveExternalJob } from "@/db/saved-external-jobs";
import { saveJob } from "@/db/saved-jobs";
import * as t from "@/db/schema";
import { isDatabaseEmpty, seedDemoData } from "@/db/seed";
import { saveSeekerProfile } from "@/db/seeker-profiles";
import { failOn } from "@/db/testing/fail-trigger";
import { decideVerification, submitVerification } from "@/db/verification-requests";
import { ensureAccount } from "@/lib/data";
import type { ExternalFacts } from "@/lib/external-jobs/types";
import { ALERT_LIMIT } from "@/components/seeker/job-alerts";
import { parseResumeDoc } from "@/components/seeker/resume-doc";

const times = (k: number) => Array.from({ length: k }, (_, i) => i);
let n = 0;
const fresh = (what: string) => `${what}.${++n}.${Date.now()}@example.com`;
const tally = (results: unknown[]) =>
  results.reduce<Record<string, number>>((all, r) => {
    const key = typeof r === "string" ? r : JSON.stringify(r);
    all[key] = (all[key] ?? 0) + 1;
    return all;
  }, {});

/** A business written directly (createEmployer is not rewritten yet), with an admin account. */
async function business(name: string, role: "admin" | "member" = "admin") {
  const db = await database();
  const id = `ez${++n}`;
  await db
    .insert(t.employers)
    .values({ id, name, verification: "unverified", regionId: "akl-cbd", createdAt: "2026-10-20" });
  const email = fresh("boss");
  await ensureAccount(email);
  await db.update(t.accounts).set({ employerId: id, teamRole: role }).where(eq(t.accounts.email, email));
  return { id, email };
}

describe("moderators", () => {
  it("grants once when the same grant arrives five times at once", async () => {
    const email = fresh("mod");
    await ensureAccount(email);
    const results = await Promise.all(times(5).map(() => grantModerator(email, null)));
    expect(tally(results)).toEqual({ granted: 1, already: 4 });
    expect((await listModerators()).filter((m) => m.email === email)).toHaveLength(1);
    expect(await grantModerator(fresh("nobody"), null)).toBe("no_account");
  });

  it("removes once, with one record, when the same removal arrives five times at once (ADR 0043)", async () => {
    const email = fresh("mod");
    await ensureAccount(email);
    await grantModerator(email, null);
    const results = await Promise.all(times(5).map(() => revokeModerator(email, null)));
    expect(tally(results)).toEqual({ revoked: 1, not_moderator: 4 });
    expect((await listModerators()).filter((m) => m.email === email)).toHaveLength(0);
    const record = (await listModeratorChanges()).filter((c) => c.email === email).map((c) => c.action);
    expect(record).toEqual(["revoke", "grant"]);
    expect(await revokeModerator(fresh("never"))).toBe("not_moderator");
  });
});

describe("saving jobs, external jobs, profiles and resume links", () => {
  it("saves a job once when it is saved five times at once", async () => {
    const email = fresh("saver");
    await ensureAccount(email);
    const results = await Promise.all(times(5).map(() => saveJob(email, "j1")));
    expect(tally(results)).toEqual({ saved: 1, already: 4 });
    expect(await saveJob(email, "no-such-job")).toBe("no_job");
    expect(await saveJob(fresh("nobody"), "j1")).toBe("no_account");
  });

  it("saves an external job once, and not one a moderator has hidden", async () => {
    const email = fresh("saver");
    await ensureAccount(email);
    const results = await Promise.all(times(5).map(() => saveExternalJob(email, "demo-kowhai:4001")));
    expect(tally(results)).toEqual({ saved: 1, already: 4 });
    const db = await database();
    await db.update(t.externalJobs).set({ review: "hidden" }).where(eq(t.externalJobs.id, "demo-kowhai:4005"));
    expect(await saveExternalJob(email, "demo-kowhai:4005")).toBe("no_job");
    expect(await saveExternalJob(fresh("nobody"), "demo-kowhai:4001")).toBe("no_account");
  });

  it("keeps one profile and one resume link per account when saves overlap", async () => {
    const email = fresh("seeker");
    await ensureAccount(email);
    const doc = parseResumeDoc({ zh: { name: "林晓" }, contact: { phone: "021" } })!;
    const shares = await Promise.all(times(4).map(() => saveResumeShare(email, doc)));
    expect(new Set(shares.map((s) => (typeof s === "string" ? s : s.id))).size).toBe(1);
    await Promise.all(times(4).map((i) => saveSeekerProfile(email, { name: `林晓${i}` })));
    const db = await database();
    const [{ n: profiles }] = await db
      .select({ n: count() })
      .from(t.seekerProfiles)
      .where(eq(t.seekerProfiles.email, email));
    expect(profiles).toBe(1);
    expect(await saveResumeShare(fresh("nobody"), doc)).toBe("no_account");
    expect(await saveSeekerProfile(fresh("nobody"), { name: "无名" })).toBe("no_account");
  });

  it("saves the business page only while the account is still its admin", async () => {
    const shop = await business("页面小店");
    const saves = await Promise.all(times(3).map((i) => saveEmployerPage(shop.email, { bio: `第${i}版` })));
    expect(saves.every((s) => typeof s === "object")).toBe(true);
    const member = await business("成员小店", "member");
    expect(await saveEmployerPage(member.email, { bio: "成员写的" })).toBe("not_admin");
    expect(await saveEmployerPage(fresh("nobody"), { bio: "x" })).toBe("no_business");
  });

  // The interleaving is deterministic only behind libSQL's queue; on D1 the order of overlapping requests is not fixed.
  it.skipIf(!!d1Binding())("reads the role again when it changed between the check and the write", async () => {
    const shop = await business("降级小店");
    const db = await database();
    const [saved] = await Promise.all([
      saveEmployerPage(shop.email, { bio: "降级前写的" }),
      db.update(t.accounts).set({ teamRole: "member" }).where(eq(t.accounts.email, shop.email)),
    ]);
    expect(saved).toBe("not_admin");
    expect(await getEmployerPage(shop.id)).toBeUndefined();
  });
});

describe("job alerts and chat starts", () => {
  it("stops at the limit, and saves a search once, when saves arrive together", async () => {
    const email = fresh("alerts");
    await ensureAccount(email);
    const queries = Array.from({ length: ALERT_LIMIT + 3 }, (_, i) => `q=${i}`);
    const results = await Promise.all(queries.map((q) => createJobAlert(email, { name: q, country: "NZ", query: q })));
    expect(results.filter((r) => r.status === "created")).toHaveLength(ALERT_LIMIT);
    expect(results.filter((r) => r.status === "limit")).toHaveLength(3);
    expect(await listJobAlerts(email)).toHaveLength(ALERT_LIMIT);

    const other = fresh("alerts");
    await ensureAccount(other);
    const same = await Promise.all(
      times(4).map(() => createJobAlert(other, { name: "同一个", country: "NZ", query: "q=same" })),
    );
    expect(tally(same.map((r) => r.status))).toEqual({ created: 1, exists: 3 });
    expect(await createJobAlert(fresh("nobody"), { name: "x", country: "NZ", query: "" })).toEqual({
      status: "no_account",
    });
  });

  it("counts a person's chat start once", async () => {
    const email = fresh("chatter");
    const results = await Promise.all(times(5).map(() => recordChatStart("j2", email)));
    expect(tally(results)).toEqual({ counted: 1, already: 4 });
  });
});

describe("renewals", () => {
  it("records each renewal against the closing date it replaced, even when two overlap", async () => {
    const db = await database();
    const [before] = await db.select({ expiresAt: t.jobs.expiresAt }).from(t.jobs).where(eq(t.jobs.id, "j3"));
    await Promise.all([
      renewJob("j3", { expiresAt: "2027-01-01T00:00:00.000Z", status: "active", days: 30 }),
      renewJob("j3", { expiresAt: "2027-02-01T00:00:00.000Z", status: "active", days: 30 }),
    ]);
    const rows = await db.select().from(t.jobRenewals).where(eq(t.jobRenewals.jobId, "j3")).orderBy(t.jobRenewals.id);
    expect(rows).toHaveLength(2);
    expect(rows[0].expiresBefore).toBe(before.expiresAt);
    expect(rows[1].expiresBefore).toBe(rows[0].expiresAfter);
    expect(await renewJob("no-such-job", { expiresAt: "2027-01-01T00:00:00.000Z", status: "active", days: 30 })).toBe(
      undefined,
    );
  });

  it("leaves no record when moving the job fails", async () => {
    const db = await database();
    const drop = await failOn(db, "jobs", "UPDATE", "NEW.id = 'j4'");
    await expect(
      renewJob("j4", { expiresAt: "2027-03-01T00:00:00.000Z", status: "active", days: 30 }),
    ).rejects.toThrow();
    await drop();
    expect(await db.select().from(t.jobRenewals).where(eq(t.jobRenewals.jobId, "j4"))).toEqual([]);
  });
});

describe("企业验证", () => {
  const application = (nzbn: string) => ({
    nzbn,
    kind: "business_verified" as const,
    legalName: "Check Shop Limited",
    contactName: "王店主",
    contactRole: "董事",
    companyPhone: "09 055 0199",
  });

  it("takes one application per business, and a new id for each, when they arrive together", async () => {
    const shop = await business("同时申请小店");
    const both = await Promise.all([
      submitVerification({ id: shop.id, name: "同时申请小店" }, shop.email, application("9429000088001")),
      submitVerification({ id: shop.id, name: "同时申请小店" }, shop.email, application("9429000088002")),
    ]);
    expect(tally(both.map((r) => r.status))).toEqual({ submitted: 1, pending: 1 });

    const shops = await Promise.all(times(4).map((i) => business(`编号小店${i}`)));
    const results = await Promise.all(
      shops.map((s, i) => submitVerification({ id: s.id, name: "编号小店" }, s.email, application(`94290000890${i}`))),
    );
    const ids = results.map((r) => (r.status === "submitted" ? r.request.id : r.status));
    expect(new Set(ids).size).toBe(4);
    expect(ids.every((id) => /^v\d+$/.test(id))).toBe(true);
  });

  it("does not reuse an id after a request was deleted (the old count + 1 did)", async () => {
    const db = await database();
    const [a, b] = [await business("删前小店"), await business("删后小店")];
    const first = await submitVerification({ id: a.id, name: "删前小店" }, a.email, application("9429000089101"));
    const second = await submitVerification({ id: b.id, name: "删后小店" }, b.email, application("9429000089102"));
    if (first.status !== "submitted" || second.status !== "submitted") throw new Error("not submitted");
    await db.delete(t.verificationRequests).where(eq(t.verificationRequests.id, first.request.id));
    const c = await business("第三家");
    const third = await submitVerification({ id: c.id, name: "第三家" }, c.email, application("9429000089103"));
    expect(third.status === "submitted" && third.request.id).not.toBe(second.request.id);
  });

  it("lets one of two moderators decide, and gives the badge only when the approval is the decision", async () => {
    const shop = await business("双审小店");
    const sent = await submitVerification({ id: shop.id, name: "双审小店" }, shop.email, application("9429000089201"));
    if (sent.status !== "submitted") throw new Error("not submitted");
    const checklist = { register: true, director: true, phone: true } as never;
    const [approved, rejected] = await Promise.all([
      decideVerification(sent.request.id, "a@example.com", checklist, { approve: true }),
      decideVerification(sent.request.id, "b@example.com", checklist, {
        approve: false,
        rejection: { reason: "other", note: "x" } as never,
      }),
    ]);
    expect([approved, rejected].filter(Boolean)).toHaveLength(1);
    const db = await database();
    const [employer] = await db.select().from(t.employers).where(eq(t.employers.id, shop.id));
    expect(employer.verification).toBe(approved ? "business_verified" : "unverified");
  });

  it("leaves the application pending when the business cannot take the badge", async () => {
    const shop = await business("失败小店");
    const sent = await submitVerification({ id: shop.id, name: "失败小店" }, shop.email, application("9429000089301"));
    if (sent.status !== "submitted") throw new Error("not submitted");
    const db = await database();
    const drop = await failOn(db, "employers", "UPDATE", `NEW.id = '${shop.id}'`);
    await expect(
      decideVerification(sent.request.id, "a@example.com", {} as never, { approve: true }),
    ).rejects.toThrow();
    await drop();
    const [row] = await db.select().from(t.verificationRequests).where(eq(t.verificationRequests.id, sent.request.id));
    expect(row.status).toBe("pending");
  });
});

describe("external companies and feeds", () => {
  const facts = (externalId: string, title = `职位 ${externalId}`): ExternalFacts =>
    ({
      externalId,
      title,
      location: "Auckland",
      city: "auckland",
      field: "software",
      kind: null,
      closesAt: null,
      minYears: null,
      degree: null,
      degreeSubjects: [],
      visa: [],
      pay: null,
      url: `https://example.com/${externalId}`,
      postedAt: null,
      flags: [],
    }) as unknown as ExternalFacts;
  const company = (id: string) => ({ id, name: `公司 ${id}`, source: "greenhouse" as const });

  it("stores a feed of 150 jobs (more than 100 parameters), and takes down the ones gone from it", async () => {
    const db = await database();
    const many = Array.from({ length: 150 }, (_, i) => facts(`${i}`));
    expect(await saveCompanyFeed(company("big"), many)).toMatchObject({ added: 150 });
    expect(await saveCompanyFeed(company("big"), many.slice(0, 120))).toMatchObject({ updated: 120, removed: 30 });
    const [{ n: gone }] = await db
      .select({ n: count() })
      .from(t.externalJobs)
      .where(and(eq(t.externalJobs.companyId, "big"), eq(t.externalJobs.removedReason, "gone")));
    expect(gone).toBe(30);
  });

  it("sends an approved job back to review when its title changes, deciding in the statement", async () => {
    const db = await database();
    await saveCompanyFeed(company("re"), [facts("1"), facts("2")]);
    await db.update(t.externalJobs).set({ review: "approved" }).where(eq(t.externalJobs.companyId, "re"));
    await saveCompanyFeed(company("re"), [facts("1", "改了标题"), facts("2")]);
    const rows = await db
      .select({ id: t.externalJobs.id, review: t.externalJobs.review })
      .from(t.externalJobs)
      .where(eq(t.externalJobs.companyId, "re"))
      .orderBy(t.externalJobs.id);
    expect(rows).toEqual([
      { id: "re:1", review: "pending" },
      { id: "re:2", review: "approved" },
    ]);
  });

  it("stores nothing of a feed when one write in it fails", async () => {
    const db = await database();
    await saveCompanyFeed(company("half"), [facts("1"), facts("2")]);
    const drop = await failOn(db, "external_jobs", "UPDATE", "NEW.removed_reason = 'gone'");
    await expect(saveCompanyFeed(company("half"), [facts("1", "新标题"), facts("3")])).rejects.toThrow();
    await drop();
    const rows = await db.select().from(t.externalJobs).where(eq(t.externalJobs.companyId, "half"));
    expect(rows.map((r) => r.title).sort()).toEqual(["职位 1", "职位 2"]);
  });

  it("stops a company once when stopped three times at once; a takedown still replaces a stop", async () => {
    await saveCompanyFeed(company("stop"), [facts("1"), facts("2")]);
    const results = await Promise.all(times(3).map(() => blockCompany("stop", { kind: "stopped", note: "停" })));
    expect(results.filter((r) => r === "already")).toHaveLength(2);
    expect(results.find((r) => r !== "already")).toEqual({ takenDown: 2 });
    expect(await blockCompany("stop", { kind: "takedown", note: "公司要求", requester: "hr@example.com" })).toEqual({
      takenDown: 0,
    });
    expect(await blockCompany("stop", { kind: "takedown", note: "再要求" })).toBe("already");
  });

  it("keeps neither the record nor the takedown when taking the jobs down fails", async () => {
    const db = await database();
    await saveCompanyFeed(company("nostop"), [facts("1")]);
    const drop = await failOn(db, "external_jobs", "UPDATE", "NEW.removed_reason = 'company_off'");
    await expect(blockCompany("nostop", { kind: "stopped", note: "停" })).rejects.toThrow();
    await drop();
    expect(
      await db.select().from(t.externalCompanyBlocks).where(eq(t.externalCompanyBlocks.companyId, "nostop")),
    ).toEqual([]);
  });

  it("resumes a company once, and its jobs go back to review only with the record", async () => {
    const db = await database();
    await saveCompanyFeed(company("resume"), [facts("1")]);
    await db.update(t.externalJobs).set({ review: "approved" }).where(eq(t.externalJobs.companyId, "resume"));
    await blockCompany("resume", { kind: "stopped", note: "停" });
    const drop = await failOn(db, "external_company_blocks", "DELETE");
    await expect(unblockCompany("resume")).rejects.toThrow();
    await drop();
    const [job] = await db.select().from(t.externalJobs).where(eq(t.externalJobs.companyId, "resume"));
    expect(job.review).toBe("approved");
    const results = await Promise.all([unblockCompany("resume"), unblockCompany("resume")]);
    expect(tally(results)).toEqual({ true: 1, false: 1 });
  });
});

describe("long lists stay under D1's 100 parameters", () => {
  it("records views of 40 records at once (5 values each)", async () => {
    const ids = Array.from({ length: 40 }, (_, i) => `subject-${i}`);
    expect(await recordViews("moderator@example.com", "profile", ids)).toBe(40);
  });

  it("reads numbers for 150 jobs, and matches a list of 150 in one parameter", async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `j${i + 1}`);
    expect(Object.keys(await jobNumbers(ids))).toHaveLength(150);
    const db = await database();
    const [{ n: found }] = await db.select({ n: count() }).from(t.jobs).where(inList(t.jobs.id, ids));
    expect(found).toBeGreaterThan(0);
    const [{ n: none }] = await db.select({ n: count() }).from(t.jobs).where(inList(t.jobs.id, []));
    expect(none).toBe(0);
  });
});

describe("the demo data", () => {
  it("goes in whole or not at all", async () => {
    const saved = process.env.DEMO_DATA;
    process.env.DEMO_DATA = "false";
    resetDatabaseForTests();
    try {
      const db = await database();
      expect(await isDatabaseEmpty(db)).toBe(true);
      const drop = await failOn(db, "external_jobs", "INSERT");
      await expect(seedDemoData(db)).rejects.toThrow();
      await drop();
      expect(await isDatabaseEmpty(db)).toBe(true);
      await seedDemoData(db);
      const [{ n: jobs }] = await db.select({ n: sql<number>`count(*)` }).from(t.jobs);
      expect(Number(jobs)).toBeGreaterThan(10);
    } finally {
      process.env.DEMO_DATA = saved;
      resetDatabaseForTests();
    }
  });
});
