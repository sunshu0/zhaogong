import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { ensureAccount, listContactViews, listReports, updateReport } from "@/lib/data";
import { grantModerator } from "@/db/moderators";
import { databaseAuthStore } from "@/db/auth-store";
import { database } from "@/db/ready";
import { reports } from "@/db/schema";
import { eq } from "drizzle-orm";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
// The request's headers: CF-Connecting-IP only where a test sets `ip` (Cloudflare's; none locally).
let ip: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => jar,
  headers: async () => new Headers(ip ? { "cf-connecting-ip": ip } : {}),
}));

const { jobSummary, reportJob, revealContact } = await import("@/app/[lang]/jobs/[id]/actions");

/** A signed-in browser: the account and a server session in the cookie. */
async function signedIn(email: string) {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, "seeker", jar);
}

beforeEach(() => {
  setAuthStoreForTests();
  cookies.clear();
  ip = undefined;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("revealContact", () => {
  it("returns the contact details to the signed-in account and records who saw them", async () => {
    await signedIn("viewer.one@example.com");
    const contact = await revealContact("j1");
    expect(contact).toEqual({ phone: "021 ••• 0101（演示）", wechat: "demo_chuanwei", email: undefined });
    const views = await listContactViews("j1");
    expect(views.filter((v) => v.viewerEmail === "viewer.one@example.com")).toHaveLength(1);
  });

  it("records the same person on the same job once per 30 minutes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T01:00:00Z"));
    await signedIn("viewer.two@example.com");
    const mine = async () => (await listContactViews("j3")).filter((v) => v.viewerEmail === "viewer.two@example.com");

    await revealContact("j3");
    await revealContact("j3"); // page opened again, or React's dev double effect
    expect(await mine()).toHaveLength(1);

    vi.setSystemTime(new Date("2026-10-12T01:31:00Z"));
    await revealContact("j3");
    expect(await mine()).toHaveLength(2);
  });

  it("returns nothing and records nothing when signed out, or for a job seekers cannot see", async () => {
    const before = (await listContactViews("j1")).length;
    expect(await revealContact("j1")).toBeNull(); // no session cookie
    await signedIn("viewer.three@example.com");
    expect(await revealContact("nope")).toBeNull();
    expect((await listContactViews("j1")).length).toBe(before);
  });
});

describe("revealContact on a job whose employer keeps contact details private", () => {
  it("returns nothing and records nothing: details are exchanged in the chat instead", async () => {
    await signedIn("viewer.private@example.com");
    const before = (await listContactViews("j2")).length;
    expect(await revealContact("j2")).toBeNull();
    expect((await listContactViews("j2")).length).toBe(before);
  });
});

describe("reportJob", () => {
  it("stores the report on the server, where the moderation queue reads it", async () => {
    const result = await reportJob("j7", "charges_fee", "  要求先交押金  ");
    expect(result.ok).toBe(true);
    const stored = (await listReports()).find((r) => result.ok && r.id === result.reportId);
    expect(stored).toMatchObject({ jobId: "j7", reason: "charges_fee", note: "要求先交押金", status: "open" });
  });

  it("rejects bad input and unknown jobs without storing anything", async () => {
    const before = (await listReports()).length;
    expect(await reportJob("j7", "spam")).toEqual({ ok: false, error: "请选择举报原因" });
    expect((await reportJob("nope", "fake_job")).ok).toBe(false);
    expect((await listReports()).length).toBe(before);
  });
});

// Security review C (ADR 0034). Each test is another browser (visitor id) or account, so the counts do not meet.
describe("reportJob: how often (security review C)", () => {
  const browser = (n: number) => cookies.set("zg_visitor", `${n}`.padStart(22, "b"));
  const close = async (result: Awaited<ReturnType<typeof reportJob>>) => {
    if (result.ok) await updateReport(result.reportId, "dismissed");
  };

  it("keeps one open report per person and job: again says 「已经举报过」, after it is handled it can be sent again", async () => {
    browser(1);
    const first = await reportJob("j7", "fake_job");
    expect(first.ok).toBe(true);
    expect(await reportJob("j7", "charges_fee", "又看到一次")).toEqual({
      ok: false,
      error: "你已经举报过这个职位，我们会尽快核查。",
    });
    expect((await reportJob("j8", "fake_job")).ok).toBe(true); // another job
    browser(2);
    expect((await reportJob("j7", "fake_job")).ok).toBe(true); // another browser

    browser(1);
    await close(first);
    const again = await reportJob("j7", "fake_job");
    expect(again.ok).toBe(true);
    // A handled report keeps no trace of who sent it; an open one keeps only the hash.
    const reporterOf = async (id: string) =>
      (await (await database()).select().from(reports).where(eq(reports.id, id)))[0]?.reporter;
    if (!first.ok || !again.ok) throw new Error("reports expected");
    expect(await reporterOf(first.reportId)).toBeNull();
    expect(await reporterOf(again.reportId)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("lets two reports sent at once by the same person in as one, the other told it is already there", async () => {
    browser(3);
    const both = await Promise.all([reportJob("j9", "fake_job"), reportJob("j9", "other", "同时点了两次")]);
    expect(both.filter((r) => r.ok)).toHaveLength(1);
    expect(both.find((r) => !r.ok)).toEqual({ ok: false, error: "你已经举报过这个职位，我们会尽快核查。" });
  });

  it("stops a browser at 5 reports a day and an account at 10, in the language of the page", async () => {
    setAuthStoreForTests(databaseAuthStore());
    browser(4);
    for (let i = 0; i < 5; i++) await close(await reportJob("j7", "fake_job"));
    expect(await reportJob("j7", "fake_job")).toEqual({
      ok: false,
      error: "今天的举报次数已经到上限，明天再试。登录后可以继续举报。",
    });

    await signedIn("reporter.limit@example.com");
    for (let i = 0; i < 10; i++) await close(await reportJob("j7", "fake_job"));
    expect(await reportJob("j7", "fake_job")).toEqual({ ok: false, error: "今天的举报次数已经到上限，明天再试。" });
  });

  it("does not count a moderator", async () => {
    await signedIn("moderator.reports@example.com");
    expect(await grantModerator("moderator.reports@example.com", null)).toBe("granted");
    for (let i = 0; i < 12; i++) {
      const result = await reportJob("j7", "fake_job");
      expect(result.ok).toBe(true);
      await close(result);
    }
  });
});

describe("jobSummary", () => {
  it("gives the chat the job's title and pay, and nothing for an unknown job", async () => {
    expect(await jobSummary("j1")).toEqual({ id: "j1", title: "前厅服务员", pay: "$25–27/小时", open: true });
    expect(await jobSummary("nope")).toBeNull();
    expect(await jobSummary(1 as unknown as string)).toBeNull();
  });
});
