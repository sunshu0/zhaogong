import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { ensureAccount, getEmployer, getJob, listJobs, listReports, submitReport, updateJob } from "@/lib/data";
import { createJobAlert, listJobAlertHits } from "@/db/job-alerts";
import { grantModerator, isModerator, listModerators } from "@/db/moderators";

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
  getModerators,
  removeModerator,
  takeDownJob,
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
      cookies.set("zg_session", "made-up-token");
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
      expect(await addModerator("just.an.employer@example.com")).toEqual(refused); // cannot promote itself
      expect(await removeModerator(MODERATOR)).toEqual(refused);
      expect(await isModerator("just.an.employer@example.com")).toBe(false);
      expect((await getJob("j10"))?.status).toBe("active");
    } finally {
      await signIn();
    }
  });
});

describe("moderators (#50)", () => {
  it("lists the moderators and says which one is asking", async () => {
    const answer = await getModerators();
    if ("refused" in answer) throw new Error(answer.refused);
    expect(answer.me).toBe(MODERATOR);
    expect(answer.moderators.map((m) => m.email)).toContain(MODERATOR);
  });

  it("adds a signed-up account by email, and only that", async () => {
    expect(await addModerator("not an email")).toEqual({ ok: false, error_zh: "请输入正确的邮箱地址。" });
    expect(await addModerator("never.signed.in@example.com")).toEqual({
      ok: false,
      error_zh: "这个邮箱还没有注册。请对方先用这个邮箱登录一次。",
    });
    await ensureAccount("helper.mod@example.com");
    expect(await addModerator(" Helper.Mod@example.com ")).toEqual({
      ok: true,
      text: "添加审核员 helper.mod@example.com",
    });
    expect(await addModerator("helper.mod@example.com")).toEqual({ ok: false, error_zh: "这个账号已经是审核员。" });
    expect((await listModerators()).find((m) => m.email === "helper.mod@example.com")?.grantedBy).toBe(MODERATOR);
  });

  it("removes a moderator, but never the last one", async () => {
    expect(await removeModerator("helper.mod@example.com")).toEqual({
      ok: true,
      text: "移除审核员 helper.mod@example.com",
    });
    expect(await removeModerator("helper.mod@example.com")).toEqual({ ok: false, error_zh: "这个账号不是审核员。" });
    for (const m of await listModerators()) if (m.email !== MODERATOR) await removeModerator(m.email);
    expect(await removeModerator(MODERATOR)).toEqual({
      ok: false,
      error_zh: "至少要留一位审核员，不能移除最后一位。",
    });
    expect(await isModerator(MODERATOR)).toBe(true);
  });
});

describe("moderation queue", () => {
  it("shows jobs flagged at posting with their findings", async () => {
    await updateJob("j10", { status: "pending_review", descriptionZh: "东区家庭清洁，也做按摩。" });
    const { flagged } = await queue();
    const item = flagged.find((f) => f.job.id === "j10");
    expect(item?.employer?.name).toBe("洁净家政");
    expect(item?.findings.map((f) => f.rule)).toEqual(["high_risk"]);
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
