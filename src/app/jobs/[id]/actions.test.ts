import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { ensureAccount, listContactViews, listReports } from "@/lib/data";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { jobSummary, reportJob, revealContact } = await import("@/app/jobs/[id]/actions");

/** A signed-in browser: the account and a server session in the cookie. */
async function signedIn(email: string) {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, "seeker", jar);
}

beforeEach(() => {
  setAuthStoreForTests();
  cookies.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("revealContact", () => {
  it("returns the contact details to the signed-in account and records who saw them", async () => {
    await signedIn("viewer.one@example.com");
    const contact = await revealContact("j1");
    expect(contact).toEqual({ phone: "021 555 0101", wechat: "demo_chuanwei", email: undefined });
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

describe("jobSummary", () => {
  it("gives the chat the job's title and pay, and nothing for an unknown job", async () => {
    expect(await jobSummary("j1")).toEqual({ id: "j1", title: "前厅服务员", pay: "$25–27/小时", open: true });
    expect(await jobSummary("nope")).toBeNull();
    expect(await jobSummary(1 as unknown as string)).toBeNull();
  });
});
