import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { ensureAccount, updateReport } from "@/lib/data";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar, headers: async () => new Headers() }));

const { reportJob } = await import("@/app/[lang]/jobs/[id]/actions");
const { myOpenReports } = await import("@/app/[lang]/me/reports/actions");

const browser = (n: number) => cookies.set("zg_visitor", `${n}`.padStart(22, "s"));
async function signIn(email: string) {
  await ensureAccount(email);
  await createSession(email, "seeker", jar);
}
async function report(jobId: string) {
  const result = await reportJob(jobId, "fake_job");
  if (!result.ok) throw new Error(result.error);
  return result.reportId;
}

beforeEach(() => {
  setAuthStoreForTests();
  cookies.clear();
});

// Each test is other browsers and accounts, so their open reports do not meet.
describe("我的举报: which of this browser's reports are open (S2, ADR 0041)", () => {
  it("is empty for a browser with neither an account nor a visitor id", async () => {
    expect(await myOpenReports()).toEqual([]);
  });

  it("lists a visitor's open reports, and not once a moderator closed them", async () => {
    browser(1);
    const first = await report("j3");
    const second = await report("j4");
    expect((await myOpenReports()).sort()).toEqual([first, second].sort());
    await updateReport(first, "actioned");
    await updateReport(second, "dismissed");
    expect(await myOpenReports()).toEqual([]);
  });

  it("gives another browser or another account none of them", async () => {
    browser(2);
    const visitors = await report("j5");
    await signIn("reports.one@example.com");
    const accounts = await report("j5");
    expect((await myOpenReports()).sort()).toEqual([accounts, visitors].sort());

    cookies.clear();
    browser(3);
    expect(await myOpenReports()).toEqual([]);
    await signIn("reports.two@example.com");
    expect(await myOpenReports()).toEqual([]);
    cookies.clear();
    await signIn("reports.one@example.com"); // the account on another device: its own, not the first browser's
    expect(await myOpenReports()).toEqual([accounts]);
  });
});
