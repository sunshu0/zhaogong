import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { sharedResume } from "@/db/resume-shares";
import { resumeDocFrom } from "@/components/seeker/resume-doc";
import { ensureAccount, openEmployerIdentity } from "@/lib/data";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { closeMyResumeShare, myResumeShareLink, shareMyResume } = await import("@/app/[lang]/profile/resume/actions");

const RESUME = resumeDocFrom({
  name: "林晓",
  headline: "",
  location: "市中心",
  languages: "普通话",
  availability: "周末",
  bio: "",
  resumeContact: { phone: true, wechat: true, email: true },
  privateDetails: { phone: "09 055 0101", wechat: "linxiao", email: "lin.private@example.com" },
});

async function signedIn(email: string, role: "seeker" | "employer" = "seeker") {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, role, jar);
}

const idOf = (path: string) => path.replace("/resume/", "");

beforeEach(() => {
  setAuthStoreForTests();
  cookies.clear();
});

describe("sharing the resume (#86)", () => {
  it("opens one link for the signed-in job seeker, without the email, and closes it", async () => {
    expect(await shareMyResume(RESUME)).toEqual({ ok: false, error: "请先登录" });
    await signedIn("resume.share@example.com");
    expect(await myResumeShareLink()).toBeNull();

    const shared = await shareMyResume(RESUME);
    if (!shared.ok) throw new Error(shared.error);
    expect(shared.share.path).toMatch(/^\/resume\/[A-Za-z0-9_-]{24}$/);
    expect(await myResumeShareLink()).toEqual(shared.share);
    const stored = await sharedResume(idOf(shared.share.path));
    expect(stored?.resume.contact).toEqual({ phone: "09 055 0101", wechat: "linxiao" });
    expect(JSON.stringify(stored)).not.toContain("lin.private@example.com");
    expect(JSON.stringify(stored)).not.toContain("resume.share@example.com");

    const again = await shareMyResume({ ...RESUME, zh: { ...RESUME.zh, name: "林晓 Lin" } });
    expect(again.ok && again.share.path).toBe(shared.share.path);

    expect(await closeMyResumeShare()).toBe(true);
    expect(await myResumeShareLink()).toBeNull();
    expect(await sharedResume(idOf(shared.share.path))).toBeUndefined();
  });

  it("refuses a page without a name, and the employer identity", async () => {
    await signedIn("resume.noname@example.com");
    expect(await shareMyResume({ ...RESUME, zh: { ...RESUME.zh, name: "" } })).toEqual({
      ok: false,
      error: "先在主页填写称呼，再分享简历",
    });
    await ensureAccount("resume.boss@example.com");
    expect((await openEmployerIdentity("resume.boss@example.com", "e2")).ok).toBe(true);
    await signedIn("resume.boss@example.com", "employer");
    expect((await shareMyResume(RESUME)).ok).toBe(false);
    expect(await myResumeShareLink()).toBeNull();
  });
});
