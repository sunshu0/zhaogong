import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { ensureAccount } from "@/lib/data";
import { grantModerator } from "@/db/moderators";
import { recordViews } from "@/db/personal-info-views";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { getPersonalInfoViews } = await import("@/app/[lang]/admin/views-actions");

const MODERATOR = "views.moderator@example.com";

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

describe("查看记录 in /admin (#336)", () => {
  it("is for moderators only", async () => {
    cookies.clear();
    expect(await getPersonalInfoViews("", 7)).toMatchObject({ refused: "signed_out" });
    await signIn("not.a.moderator@example.com");
    expect(await getPersonalInfoViews("", 7)).toMatchObject({ refused: "not_moderator" });
  });

  it("lists by moderator and period; anything else asked for is everyone over 7 days", async () => {
    const now = new Date();
    await recordViews(MODERATOR, "verification", ["vr-a"], now);
    await recordViews("other.moderator@example.com", "verification", ["vr-b"], now);
    await recordViews(MODERATOR, "verification", ["vr-month"], new Date(now.getTime() - 20 * 86_400_000));
    await signIn(MODERATOR);

    const all = await getPersonalInfoViews("", 7);
    if ("refused" in all) throw new Error(all.error_zh);
    expect(all.views.map((v) => v.subjectId).sort()).toEqual(["vr-a", "vr-b"]);
    expect(all.moderators).toEqual(["other.moderator@example.com", MODERATOR]);

    const mine = await getPersonalInfoViews(MODERATOR, 30);
    if ("refused" in mine) throw new Error(mine.error_zh);
    expect(mine).toMatchObject({ days: 30, moderator: MODERATOR, more: false });
    expect(mine.views.map((v) => v.subjectId)).toEqual(["vr-a", "vr-month"]);

    const odd = await getPersonalInfoViews("nobody@example.com", 5);
    if ("refused" in odd) throw new Error(odd.error_zh);
    expect(odd).toMatchObject({ days: 7, moderator: "" });
    expect(odd.views).toHaveLength(2);
  });
});
