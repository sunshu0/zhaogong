import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { identityScope } from "@/components/seeker/identity-scope";
import { ensureAccount, openEmployerIdentity } from "@/lib/data";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { myProfile, saveMyProfile } = await import("@/app/[lang]/profile/actions");
const { recommendedCandidates } = await import("@/app/[lang]/profile/candidate-actions");

async function signedIn(email: string, role: "seeker" | "employer" = "seeker") {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, role, jar);
}

const seekerScope = (email: string) => identityScope({ email, signedInAt: "", activeRole: "seeker" });

beforeEach(() => {
  setAuthStoreForTests();
  cookies.clear();
});

describe("我的主页 on the account (#104)", () => {
  it("has no page until the account saves one, then gives it back on any device", async () => {
    await signedIn("page.one@example.com");
    expect(await myProfile()).toEqual({ scope: seekerScope("page.one@example.com"), profile: null, updatedAt: null });

    const saved = await saveMyProfile({
      name: "王芳",
      bio: "会做咖啡",
      privateDetails: { phone: "021 1", wechat: "", email: "" },
    });
    expect(saved).toMatchObject({ profile: { name: "王芳", bio: "会做咖啡" }, updatedAt: expect.any(String) });

    // Another browser, same account.
    await signedIn("page.one@example.com");
    expect(await myProfile()).toEqual(saved);
  });

  it("keeps the last page sent, whole", async () => {
    await signedIn("page.two@example.com");
    await saveMyProfile({ name: "王芳", bio: "会做咖啡" });
    await saveMyProfile({ name: "王芳" });
    expect((await myProfile())?.profile).toEqual({ name: "王芳" });
  });

  it("keeps only what it can read, and refuses what is not a page", async () => {
    await signedIn("page.three@example.com");
    const saved = await saveMyProfile({ name: "王芳", isAdmin: true, avatar: "javascript:alert(1)", bio: 3 });
    expect(saved?.profile).toEqual({ name: "王芳" });
    expect(await saveMyProfile("not a page")).toBeNull();
    expect(await saveMyProfile({ bio: "x".repeat(300_000) })).toBeNull();
    expect((await myProfile())?.profile).toEqual({ name: "王芳" });
  });

  it("is only for a signed-in job seeker: signed out and the employer identity get nothing", async () => {
    expect(await myProfile()).toBeNull();
    expect(await saveMyProfile({ name: "王芳" })).toBeNull();

    await ensureAccount("page.boss@example.com");
    await openEmployerIdentity("page.boss@example.com", "e2");
    await signedIn("page.boss@example.com", "employer");
    expect(await myProfile()).toBeNull();
    expect(await saveMyProfile({ name: "川味小馆" })).toBeNull();
  });

  it("gives each account its own page", async () => {
    await signedIn("page.a@example.com");
    await saveMyProfile({ name: "甲" });
    await signedIn("page.b@example.com");
    expect((await myProfile())?.profile).toBeNull();
  });
});

describe("推荐人才 from the accounts (#104)", () => {
  let next = 0;
  const ids = new Map<string, string>();
  const idOf = (name: string) => ids.get(name) ?? (ids.set(name, `cand-${++next}`), ids.get(name)!);
  const listed = (name: string, discoverable = true) => ({
    name,
    headline: "前厅服务",
    privateDetails: { phone: "09 055 0199", wechat: "wx-private", email: "private@example.com" },
    resume: { candidateId: idOf(name), discoverable, skills: "收银", employmentTypes: [], regionIds: [] },
  });

  it("shows an employer the job seekers who allowed it, public fields only", async () => {
    await signedIn("listed.one@example.com");
    await saveMyProfile(listed("公开的赵敏"));
    await signedIn("listed.two@example.com");
    await saveMyProfile(listed("不公开的钱多", false));

    await ensureAccount("listed.boss@example.com");
    await openEmployerIdentity("listed.boss@example.com", "e3");
    await signedIn("listed.boss@example.com", "employer");
    const answer = await recommendedCandidates();
    const names = answer!.candidates.map((c) => c.name);
    expect(names).toContain("公开的赵敏");
    expect(names).not.toContain("不公开的钱多");
    const one = answer!.candidates.find((c) => c.name === "公开的赵敏")!;
    expect(one).toMatchObject({ id: `local-${idOf("公开的赵敏")}`, headline: "前厅服务" });
    expect(JSON.stringify(answer)).not.toMatch(/listed\.one|09 055 0199|wx-private|private@example/);
  });

  it("leaves the employer's own job seeker page out, and stops showing a page once it is withdrawn", async () => {
    await signedIn("listed.self@example.com");
    await saveMyProfile(listed("老板自己"));
    await openEmployerIdentity("listed.self@example.com", "e4");
    await signedIn("listed.self@example.com", "employer");
    expect((await recommendedCandidates())!.candidates.map((c) => c.name)).not.toContain("老板自己");

    await signedIn("listed.three@example.com");
    await saveMyProfile(listed("后来关掉的孙丽"));
    await signedIn("listed.self@example.com", "employer");
    expect((await recommendedCandidates())!.candidates.map((c) => c.name)).toContain("后来关掉的孙丽");
    await signedIn("listed.three@example.com");
    await saveMyProfile(listed("后来关掉的孙丽", false));
    await signedIn("listed.self@example.com", "employer");
    expect((await recommendedCandidates())!.candidates.map((c) => c.name)).not.toContain("后来关掉的孙丽");
  });

  it("gives nothing to a job seeker or someone signed out", async () => {
    expect(await recommendedCandidates()).toBeNull();
    await signedIn("listed.seeker@example.com");
    expect(await recommendedCandidates()).toBeNull();
  });
});
