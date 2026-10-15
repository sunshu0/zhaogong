import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { ensureAccount, getEmployer, getJob, listJobs, listReports, submitReport, updateJob } from "@/lib/data";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { approveJob, banJobEmployer, dismissReports, getModerationQueue, takeDownJob } =
  await import("@/app/admin/actions");

const MODERATOR = "moderator@example.com";

async function signIn() {
  cookies.clear();
  await ensureAccount(MODERATOR);
  await createSession(MODERATOR, "seeker", jar);
}

/** The queue for a signed-in browser. */
async function queue() {
  const q = await getModerationQueue();
  if (!q) throw new Error("getModerationQueue: signed out");
  return q;
}

// /admin is open only with ADMIN_ENABLED=1 (local development sets it in .env.development),
// and then only to a signed-in session. There is no moderator role yet.
beforeAll(async () => {
  vi.stubEnv("ADMIN_ENABLED", "1");
  setAuthStoreForTests();
  await signIn();
});
afterAll(() => {
  vi.unstubAllEnvs();
});

describe("admin switch", () => {
  it("refuses every Server Function while ADMIN_ENABLED is not 1", async () => {
    for (const value of ["", "0", "true"]) {
      vi.stubEnv("ADMIN_ENABLED", value);
      await expect(getModerationQueue()).rejects.toThrow("审核后台未开放");
      await expect(approveJob("j10")).rejects.toThrow("审核后台未开放");
      await expect(takeDownJob("j10")).rejects.toThrow("审核后台未开放");
      await expect(dismissReports("j10")).rejects.toThrow("审核后台未开放");
      await expect(banJobEmployer("j10")).rejects.toThrow("审核后台未开放");
    }
    expect((await getJob("j10"))?.status).toBe("active");
    vi.stubEnv("ADMIN_ENABLED", "1");
    await expect(getModerationQueue()).resolves.toBeTruthy();
  });

  it("refuses a browser that is not signed in (#19)", async () => {
    cookies.clear();
    try {
      expect(await getModerationQueue()).toBeNull();
      for (const act of [approveJob, takeDownJob, dismissReports, banJobEmployer]) {
        expect(await act("j10")).toEqual({ ok: false, error_zh: "请先登录。" });
      }
      cookies.set("zg_session", "made-up-token");
      expect(await getModerationQueue()).toBeNull();
      expect(await takeDownJob("j10")).toEqual({ ok: false, error_zh: "请先登录。" });
      expect((await getJob("j10"))?.status).toBe("active");
      expect((await getEmployer((await getJob("j10"))!.employerId))?.bannedAt).toBeUndefined();
    } finally {
      await signIn();
    }
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
    const result = await approveJob("j10");
    expect(result).toEqual({ ok: true, text: "审核通过「家庭清洁」（洁净家政） · 标记：高风险行业" });
    const job = await getJob("j10");
    expect(job?.status).toBe("active");
    expect(Date.parse(job!.expiresAt) - Date.now()).toBeGreaterThan(29 * 86_400_000);
    expect((await queue()).flagged.map((f) => f.job.id)).not.toContain("j10");
    expect(await approveJob("j10")).toMatchObject({ ok: false });
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
    expect((await listJobs({ country: "NZ" })).map((j) => j.id)).not.toContain("j1");
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
  });
});
