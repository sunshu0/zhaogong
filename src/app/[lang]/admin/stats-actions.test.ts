import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { ensureAccount, listReports, submitReport } from "@/lib/data";
import { grantModerator } from "@/db/moderators";
import { recordAiUsage } from "@/db/ai-usage";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { getFunnels, getModerationStats } = await import("@/app/[lang]/admin/stats-actions");
const { dismissReports, takeDownJob } = await import("@/app/[lang]/admin/actions");

const MODERATOR = "stats.moderator@example.com";

async function signIn(email: string) {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, "seeker", jar);
}

beforeAll(async () => {
  vi.stubEnv("ADMIN_ENABLED", "1");
  setAuthStoreForTests();
  await ensureAccount(MODERATOR);
  await grantModerator(MODERATOR, null);
});
afterAll(() => {
  vi.unstubAllEnvs();
});

describe("审核数据 (#70)", () => {
  it("is for moderators only", async () => {
    cookies.clear();
    expect(await getModerationStats()).toEqual({ refused: "signed_out", error_zh: "请先登录。" });
    await signIn("not.a.moderator@example.com");
    expect(await getModerationStats()).toMatchObject({ refused: "not_moderator" });
  });

  it("counts what waits now, and this week's reports, closings, take-downs", async () => {
    await signIn(MODERATOR);
    const before = await getModerationStats();
    if ("refused" in before) throw new Error(before.error_zh);

    await submitReport("j4", "fake_job");
    await submitReport("j5", "charges_fee");
    const waiting = await getModerationStats();
    if ("refused" in waiting) throw new Error(waiting.error_zh);
    expect(waiting.openReports).toBe(before.openReports + 2);
    expect(waiting.weeks[0].reported).toBe(before.weeks[0].reported + 2);
    expect(waiting.oldestOpenReportAt).toBeDefined();

    expect(await takeDownJob("j4")).toMatchObject({ ok: true });
    expect(await dismissReports("j5")).toMatchObject({ ok: true });
    const closed = (await listReports()).filter((r) => ["j4", "j5"].includes(r.jobId));
    expect(closed.every((r) => r.status !== "open" && r.handledAt)).toBe(true); // closing time kept

    const after = await getModerationStats();
    if ("refused" in after) throw new Error(after.error_zh);
    expect(after.openReports).toBe(before.openReports);
    expect(after.weeks[0].handled).toBe(before.weeks[0].handled + closed.length);
    expect(after.weeks[0].takenDown).toBe(before.weeks[0].takenDown + 1);
    expect(after.weeks[0].medianHandleMs).toBeGreaterThanOrEqual(0);
  });

  it("adds up today's calls to the AI 发帖 model (#102), without saying whose", async () => {
    await signIn(MODERATOR);
    const before = await getModerationStats();
    if ("refused" in before) throw new Error(before.error_zh);
    const tokens = { input: 500, output: 100, cacheRead: 0, cacheWrite: 0 };
    await recordAiUsage("poster@example.com", { model: "fake", usage: tokens, result: "ok" });
    await recordAiUsage("poster@example.com", { model: "fake", result: "limited" });
    const after = await getModerationStats();
    if ("refused" in after) throw new Error(after.error_zh);
    expect(after.aiPosting.days[0].calls).toBe(before.aiPosting.days[0].calls + 1);
    expect(after.aiPosting.days[0].tokens).toBe(before.aiPosting.days[0].tokens + 600);
    expect(after.aiPosting.total.limited).toBe(before.aiPosting.total.limited + 1);
    expect(JSON.stringify(after)).not.toContain("poster@example.com");
  });
});

describe("审核数据's 漏斗 (#316, ADR 0025)", () => {
  it("is for moderators only", async () => {
    cookies.clear();
    expect(await getFunnels(7)).toEqual({ refused: "signed_out", error_zh: "请先登录。" });
    await signIn("not.a.moderator@example.com");
    expect(await getFunnels(7)).toMatchObject({ refused: "not_moderator" });
  });

  it("counts the stored events' visitors per step, and sends counts only", async () => {
    const { recordEvent } = await import("@/db/events");
    const now = new Date();
    for (let i = 0; i < 6; i += 1) {
      const visitor = `funnel-report-${i}`.padEnd(64, "0");
      await recordEvent({ name: "post_view", path: "/employer/post", visitor, lang: "zh", role: "employer" }, now);
      if (i < 5)
        await recordEvent(
          { name: "post_mode", path: "/employer/post", detail: "paste", visitor, lang: "zh", role: "employer" },
          now,
        );
    }
    await signIn(MODERATOR);
    const report = await getFunnels(30);
    if ("refused" in report) throw new Error(report.error_zh);
    expect(report.days).toBe(30);
    const post = report.funnels.find((f) => f.id === "post")!.steps;
    expect(typeof post[0].counts.all === "number" && post[0].counts.all >= 6).toBe(true);
    expect(JSON.stringify(report)).not.toContain("funnel-report-");
    // Anything but 7 or 30 is 7.
    expect(await getFunnels(365)).toMatchObject({ days: 7 });
  });
});
