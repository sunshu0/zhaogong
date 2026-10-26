import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createSession, sessionCookieName, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import {
  ensureAccount,
  getEmployer,
  getJob,
  listJobs,
  listJobsByEmployer,
  listReports,
  submitReport,
  updateJob,
  updateReport,
} from "@/lib/data";
import { createJobAlert, listJobAlertHits } from "@/db/job-alerts";
import { grantModerator, isModerator, listModerators } from "@/db/moderators";
import { memoryStore, setEvidenceStoreForTests } from "@/db/evidence-store";
import { listReportEvidence, resetEvidenceCleanupForTests } from "@/db/report-evidence";
import { EVIDENCE_KEEP_DAYS } from "@/lib/report-evidence";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const {
  addModerator,
  approveJob,
  banJobEmployer,
  dismissReports,
  getModerationQueue,
  getModeratorChanges,
  getModerators,
  getTempBans,
  liftEmployerTempBan,
  makeEmployerBanPermanent,
  removeModerator,
  takeDownJob,
  tempBanJobEmployer,
} = await import("@/app/[lang]/admin/actions");

const MODERATOR = "the.moderator@example.com";

/** A browser signed in as `email` (the moderator by default). */
async function signIn(email = MODERATOR) {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, "seeker", jar);
}

/** The queue for the moderator's browser. */
async function queue() {
  const q = await getModerationQueue();
  if ("refused" in q) throw new Error(`getModerationQueue: ${q.refused}`);
  return q;
}

// /admin is open only with ADMIN_ENABLED=1 (local development sets it in .env.development),
// and then only to a signed-in moderator (#50).
beforeAll(async () => {
  vi.stubEnv("ADMIN_ENABLED", "1");
  setAuthStoreForTests();
  await ensureAccount(MODERATOR);
  await grantModerator(MODERATOR, null);
  await signIn();
});
afterAll(() => {
  vi.unstubAllEnvs();
});

describe("report evidence past its 180 days (security review E)", () => {
  it("goes when a moderator opens the queue, with no new report; evidence not yet that old stays", async () => {
    const files = memoryStore();
    setEvidenceStoreForTests(files);
    try {
      const reporter = "queue.evidence@example.com";
      await ensureAccount(reporter);
      const report = async (key: string, handledDaysAgo: number) => {
        await files.put(key, new Uint8Array([1]), "image/png");
        const images = [{ key, type: "image/png" as const, bytes: 1 }];
        const r = await submitReport("j2", "charges_fee", undefined, { reporterEmail: reporter, messages: [], images });
        await updateReport(r.id, "dismissed", new Date(Date.now() - handledDaysAgo * 86_400_000));
        return r.id;
      };
      const old = await report("8f1d2c3b-0000-4000-8000-000000000001", EVIDENCE_KEEP_DAYS + 1);
      const recent = await report("8f1d2c3b-0000-4000-8000-000000000002", EVIDENCE_KEEP_DAYS - 1);
      resetEvidenceCleanupForTests(); // as on a new day

      await queue();
      expect(await listReportEvidence(old)).toEqual([]);
      expect(await listReportEvidence(recent)).toHaveLength(1);
      expect(files.keys()).toEqual(["8f1d2c3b-0000-4000-8000-000000000002"]);
    } finally {
      setEvidenceStoreForTests(undefined);
    }
  });
});

describe("admin switch", () => {
  it("refuses every Server Function while ADMIN_ENABLED is not 1", async () => {
    for (const value of ["", "0", "true"]) {
      vi.stubEnv("ADMIN_ENABLED", value);
      await expect(getModerationQueue()).rejects.toThrow("/admin is switched off");
      await expect(approveJob("j10")).rejects.toThrow("/admin is switched off");
      await expect(takeDownJob("j10")).rejects.toThrow("/admin is switched off");
      await expect(dismissReports("j10")).rejects.toThrow("/admin is switched off");
      await expect(banJobEmployer("j10")).rejects.toThrow("/admin is switched off");
    }
    expect((await getJob("j10"))?.status).toBe("active");
    vi.stubEnv("ADMIN_ENABLED", "1");
    await expect(queue()).resolves.toBeTruthy();
  });

  it("refuses a browser that is not signed in (#19)", async () => {
    cookies.clear();
    try {
      expect(await getModerationQueue()).toMatchObject({ refused: "signed_out" });
      expect(await getModerators()).toMatchObject({ refused: "signed_out" });
      for (const act of [approveJob, takeDownJob, dismissReports, banJobEmployer, addModerator, removeModerator]) {
        expect(await act("j10")).toEqual({ ok: false, error_zh: "请先登录。" });
      }
      expect(await tempBanJobEmployer("j10", 7, "押金")).toEqual({ ok: false, error_zh: "请先登录。" });
      expect(await liftEmployerTempBan("e6")).toEqual({ ok: false, error_zh: "请先登录。" });
      expect(await makeEmployerBanPermanent("e6")).toEqual({ ok: false, error_zh: "请先登录。" });
      expect(await getTempBans()).toMatchObject({ refused: "signed_out" });
      cookies.set(sessionCookieName(), "made-up-token");
      expect(await getModerationQueue()).toMatchObject({ refused: "signed_out" });
      expect(await takeDownJob("j10")).toEqual({ ok: false, error_zh: "请先登录。" });
      expect((await getJob("j10"))?.status).toBe("active");
      expect((await getEmployer((await getJob("j10"))!.employerId))?.bannedAt).toBeUndefined();
    } finally {
      await signIn();
    }
  });

  it("refuses a signed-in account that is not a moderator (#50)", async () => {
    await signIn("just.an.employer@example.com");
    try {
      const refused = { ok: false, error_zh: "只有审核员能使用审核后台。" };
      expect(await getModerationQueue()).toMatchObject({ refused: "not_moderator" });
      expect(await getModerators()).toMatchObject({ refused: "not_moderator" });
      for (const act of [approveJob, takeDownJob, dismissReports, banJobEmployer]) {
        expect(await act("j10")).toEqual(refused);
      }
      expect(await tempBanJobEmployer("j10", 7, "押金")).toEqual(refused);
      expect(await liftEmployerTempBan("e6")).toEqual(refused);
      expect(await makeEmployerBanPermanent("e6")).toEqual(refused);
      expect(await getTempBans()).toMatchObject({ refused: "not_moderator" });
      expect(await getEmployer("e6")).not.toHaveProperty("bannedAt");
      expect(await addModerator("just.an.employer@example.com")).toEqual(refused); // cannot promote itself
      expect(await removeModerator(MODERATOR)).toEqual(refused);
      expect(await isModerator("just.an.employer@example.com")).toBe(false);
      expect((await getJob("j10"))?.status).toBe("active");
    } finally {
      await signIn();
    }
  });
});

describe("moderators (#50; ADR 0043: only admins add and remove them)", () => {
  const ADMIN = "the.admin@example.com";
  const asAdmin = async () => {
    vi.stubEnv("ZHAOGONG_ADMIN_EMAILS", ADMIN);
    await signIn(ADMIN);
  };
  afterEach(async () => {
    vi.stubEnv("ZHAOGONG_ADMIN_EMAILS", "");
    await signIn();
  });

  it("lists the admins and the moderators, and says who is asking and whether they are an admin", async () => {
    vi.stubEnv("ZHAOGONG_ADMIN_EMAILS", ADMIN);
    const answer = await getModerators();
    if ("refused" in answer) throw new Error(answer.refused);
    expect(answer).toMatchObject({ me: MODERATOR, admin: false, admins: [ADMIN] });
    expect(answer.moderators.map((m) => m.email)).toContain(MODERATOR);
  });

  it("lets a moderator who is not an admin only look: the server refuses the rest", async () => {
    vi.stubEnv("ZHAOGONG_ADMIN_EMAILS", ADMIN);
    const adminOnly = { ok: false, error_zh: "只有管理员能添加、移除审核员。" };
    await ensureAccount("would.be@example.com");
    expect(await addModerator("would.be@example.com")).toEqual(adminOnly);
    expect(await removeModerator(MODERATOR)).toEqual(adminOnly);
    expect(await isModerator("would.be@example.com")).toBe(false);
    expect(await isModerator(MODERATOR)).toBe(true);
    expect(await getModeratorChanges()).toMatchObject({ refused: "not_admin" });
  });

  it("lets an admin add a signed-up account with no job seeker's or employer's data, and only that", async () => {
    await asAdmin();
    expect(await addModerator("not an email")).toEqual({ ok: false, error_zh: "请输入正确的邮箱地址。" });
    expect(await addModerator("never.signed.in@example.com")).toEqual({
      ok: false,
      error_zh: "这个邮箱还没有注册。请对方先用这个邮箱登录一次。",
    });
    await ensureAccount("job.hunter@example.com");
    await createJobAlert("job.hunter@example.com", { name: "厨房", country: "NZ", query: "industry=hospitality" });
    expect(await addModerator("job.hunter@example.com")).toEqual({
      ok: false,
      error_zh: "这个邮箱已经有求职或招聘的数据。请用一个专门的审核员邮箱。",
    });
    await ensureAccount("helper.mod@example.com");
    expect(await addModerator(" Helper.Mod@example.com ")).toEqual({
      ok: true,
      text: "添加审核员 helper.mod@example.com",
    });
    expect(await addModerator("helper.mod@example.com")).toEqual({ ok: false, error_zh: "这个账号已经是审核员。" });
    expect((await listModerators()).find((m) => m.email === "helper.mod@example.com")?.grantedBy).toBe(ADMIN);
  });

  it("lets an admin remove moderators, down to none but never an admin, and records each change", async () => {
    await asAdmin();
    expect(await removeModerator("helper.mod@example.com")).toEqual({
      ok: true,
      text: "移除审核员 helper.mod@example.com",
    });
    expect(await removeModerator("helper.mod@example.com")).toEqual({ ok: false, error_zh: "这个账号不是审核员。" });
    expect(await removeModerator(ADMIN)).toEqual({ ok: false, error_zh: "管理员在服务器配置里设定，不能在这里移除。" });
    const answer = await getModeratorChanges();
    if ("refused" in answer) throw new Error(answer.refused);
    expect(answer.changes.slice(0, 2)).toMatchObject([
      { action: "revoke", email: "helper.mod@example.com", by: ADMIN },
      { action: "grant", email: "helper.mod@example.com", by: ADMIN },
    ]);
    for (const m of await listModerators()) await removeModerator(m.email);
    expect(await listModerators()).toEqual([]);
    expect(await isModerator(ADMIN)).toBe(true);
    await grantModerator(MODERATOR, null); // for the tests below
  });
});

describe("moderation queue", () => {
  it("shows jobs flagged at posting with their findings", async () => {
    await updateJob("j10", { status: "pending_review", descriptionZh: "东区家庭清洁，也做按摩。" });
    const { flagged } = await queue();
    const item = flagged.find((f) => f.job.id === "j10");
    expect(item?.employer?.name).toBe("洁净家政");
    expect(item?.findings.map((f) => f.rule)).toEqual(["high_risk"]);
    // The queue never shows a job's contact details, so they stay on the server (#336).
    expect(item?.job).not.toHaveProperty("contact");
  });

  it("approves a flagged job: live for 30 days from now, and logged", async () => {
    await ensureAccount("alert.cleaner@example.com");
    await createJobAlert("alert.cleaner@example.com", { name: "清洁", country: "NZ", query: "industry=cleaning" });
    const result = await approveJob("j10");
    expect(result).toEqual({ ok: true, text: "审核通过「家庭清洁」（洁净家政） · 标记：高风险行业" });
    const job = await getJob("j10");
    expect(job?.status).toBe("active");
    expect(Date.parse(job!.expiresAt) - Date.now()).toBeGreaterThan(29 * 86_400_000);
    expect((await queue()).flagged.map((f) => f.job.id)).not.toContain("j10");
    expect(await approveJob("j10")).toMatchObject({ ok: false });
    // Now live, so the job seeker whose alert it matches is told (#53).
    expect((await listJobAlertHits("alert.cleaner@example.com")).map((hit) => hit.jobId)).toEqual(["j10"]);
  });

  it("refuses to approve what still breaks the rules", async () => {
    await updateJob("j6", { status: "pending_review", pay: { min: 20 } });
    expect(await approveJob("j6")).toEqual({ ok: false, error_zh: "这个职位仍有不能发布的问题，只能下架。" });
  });

  it("groups reports by job; taking a job down closes its reports", async () => {
    await submitReport("j1", "charges_fee", "电话里说要交押金");
    await submitReport("j1", "fake_job");
    const { reported } = await queue();
    expect(reported[0]).toMatchObject({ job: { id: "j1" }, employer: { name: "川味小馆" } });
    expect(reported[0].reports).toHaveLength(2);

    const result = await takeDownJob("j1");
    expect(result.ok && result.text).toBe("下架「前厅服务员」（川味小馆） · 举报：虚假职位、收押金 / 介绍费");
    expect((await getJob("j1"))?.status).toBe("removed");
    expect((await listReports()).filter((r) => r.jobId === "j1").map((r) => r.status)).toEqual([
      "actioned",
      "actioned",
    ]);
    expect((await listJobs({ country: "NZ" }, Date.now())).map((j) => j.id)).not.toContain("j1");
  });

  it("dismisses reports and leaves the job live", async () => {
    await submitReport("j13", "other", "看错了");
    expect(await dismissReports("j13")).toMatchObject({ ok: true });
    expect((await getJob("j13"))?.status).toBe("active");
    expect((await queue()).reported.map((r) => r.job.id)).not.toContain("j13");
  });

  it("bans the employer behind a reported job, takes all their jobs down, and logs it newest first", async () => {
    await submitReport("j11", "visa_selling");
    const result = await banJobEmployer("j11");
    expect(result).toEqual({ ok: true, text: "封禁雇主「快达物流」，下架 2 个职位" });
    expect((await getEmployer("e7"))?.bannedAt).toBeTruthy();
    expect([(await getJob("j11"))?.status, (await getJob("j12"))?.status]).toEqual(["removed", "removed"]);
    expect(await banJobEmployer("j12")).toMatchObject({ ok: false, error_zh: "这个雇主已经被封禁。" });

    const { log, reported } = await queue();
    expect(reported.map((r) => r.job.id)).not.toContain("j11");
    expect(log[0].text).toBe("封禁雇主「快达物流」，下架 2 个职位");
    expect(log.map((e) => e.action)).toEqual(["ban", "dismiss", "take_down", "approve"]);
    // Every decision names the moderator who made it (#60).
    expect(log.map((e) => e.moderator)).toEqual([MODERATOR, MODERATOR, MODERATOR, MODERATOR]);
  });
});

describe("temporary bans (ADR 0044)", () => {
  const DAY = 86_400_000;
  const live = async () => (await listJobs({ country: "NZ" }, Date.now())).map((j) => j.id);

  it("needs 3, 7 or 30 days and a reason of at most 200 characters, and writes nothing otherwise", async () => {
    expect(await tempBanJobEmployer("j8", 5, "押金")).toEqual({
      ok: false,
      error_zh: "暂时封禁只能选 3 天、7 天或 30 天。",
    });
    expect(await tempBanJobEmployer("j8", "7", "押金")).toMatchObject({ ok: false });
    for (const reason of [undefined, "", "   "])
      expect(await tempBanJobEmployer("j8", 7, reason)).toEqual({
        ok: false,
        error_zh: "请写明封禁的原因，雇主会看到。",
      });
    expect(await tempBanJobEmployer("j8", 7, "押".repeat(201))).toEqual({ ok: false, error_zh: "原因最多 200 个字。" });
    expect(await getEmployer("e5")).not.toHaveProperty("bannedAt");
    // A permanent ban (快达物流, banned above) is not turned into a temporary one.
    expect(await tempBanJobEmployer("j12", 3, "押金")).toEqual({ ok: false, error_zh: "这个雇主已经被封禁。" });
  });

  it("bans for the days picked, hides the jobs without taking them down, and lifts early once", async () => {
    await submitReport("j8", "charges_fee", "电话里说要交押金");
    const before = Date.now();
    expect(await tempBanJobEmployer("j8", 7, " 电话里收押金 ")).toEqual({
      ok: true,
      text: "暂时封禁雇主「安居装修」7 天 · 电话里收押金",
    });
    const banned = await getEmployer("e5");
    expect(banned?.banReason).toBe("电话里收押金");
    expect(Date.parse(banned!.bannedUntil!) - before).toBeGreaterThanOrEqual(7 * DAY);
    expect(Date.parse(banned!.bannedUntil!) - Date.now()).toBeLessThanOrEqual(7 * DAY);
    expect([(await getJob("j8"))?.status, (await getJob("j9"))?.status]).toEqual(["active", "active"]);
    expect(await live()).not.toContain("j8");
    expect(await live()).not.toContain("j9");
    expect((await listReports()).filter((r) => r.jobId === "j8").map((r) => r.status)).toEqual(["actioned"]);

    const bans = await getTempBans();
    if ("refused" in bans) throw new Error(`getTempBans: ${bans.refused}`);
    expect(bans).toEqual([
      { employerId: "e5", employerName: "安居装修", until: banned!.bannedUntil, reason: "电话里收押金", by: MODERATOR },
    ]);

    expect(await liftEmployerTempBan("e5")).toEqual({ ok: true, text: "提前解除对雇主「安居装修」的暂时封禁" });
    expect(await live()).toEqual(expect.arrayContaining(["j8", "j9"]));
    expect(await getTempBans()).toEqual([]);
    expect(await liftEmployerTempBan("e5")).toEqual({ ok: false, error_zh: "这家企业现在没有被暂时封禁。" });
    // A permanent ban is not lifted here.
    expect(await liftEmployerTempBan("e7")).toEqual({ ok: false, error_zh: "这家企业现在没有被暂时封禁。" });
  });

  it("makes a temporary ban permanent: the live jobs come down, and each step is in the log", async () => {
    // 悦美发型工作室's jobs that come down, as with 封禁雇主: live or waiting for review (j7 and the demo showcase's).
    const theirs = (await listJobsByEmployer("e4"))
      .filter((j) => j.status === "active" || j.status === "pending_review")
      .map((j) => j.id);
    expect(theirs).toContain("j7");
    expect(await tempBanJobEmployer("j7", 3, "态度恶劣")).toMatchObject({ ok: true });
    expect(await makeEmployerBanPermanent("e4")).toEqual({
      ok: true,
      text: `把对雇主「悦美发型工作室」的暂时封禁改成永久，下架 ${theirs.length} 个职位`,
    });
    const employer = await getEmployer("e4");
    expect(employer?.bannedAt).toBeTruthy();
    expect(employer).not.toHaveProperty("bannedUntil");
    for (const id of theirs) expect((await getJob(id))?.status).toBe("removed");
    expect(await makeEmployerBanPermanent("e4")).toEqual({ ok: false, error_zh: "这家企业现在没有被暂时封禁。" });
    expect(await liftEmployerTempBan("e4")).toMatchObject({ ok: false });
    expect(await makeEmployerBanPermanent("e5")).toMatchObject({ ok: false });

    const { log } = await queue();
    expect(log.slice(0, 4).map((e) => [e.action, e.moderator])).toEqual([
      ["make_permanent", MODERATOR],
      ["temp_ban", MODERATOR],
      ["unban", MODERATOR],
      ["temp_ban", MODERATOR],
    ]);
    expect(log[1].text).toBe("暂时封禁雇主「悦美发型工作室」3 天 · 态度恶劣");
  });
});
