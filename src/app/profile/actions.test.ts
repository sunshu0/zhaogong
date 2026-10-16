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

const { myProfile, saveMyProfile } = await import("@/app/profile/actions");

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
