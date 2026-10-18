import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { ensureAccount } from "@/lib/data";
import { grantModerator } from "@/db/moderators";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { canModerate } = await import("@/app/[lang]/admin/entry-actions");

const MODERATOR = "entry.moderator@example.com";
const SEEKER = "entry.seeker@example.com";

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

describe("canModerate (#73: the way into /admin)", () => {
  it("is true for a signed-in moderator", async () => {
    await signIn(MODERATOR);
    expect(await canModerate()).toBe(true);
  });

  it("is false for any other account, and when signed out", async () => {
    await signIn(SEEKER);
    expect(await canModerate()).toBe(false);
    cookies.clear();
    expect(await canModerate()).toBe(false);
  });

  it("is false for a moderator while /admin is switched off, without throwing", async () => {
    await signIn(MODERATOR);
    for (const value of ["", "0", "true"]) {
      vi.stubEnv("ADMIN_ENABLED", value);
      expect(await canModerate()).toBe(false);
    }
    vi.stubEnv("ADMIN_ENABLED", "1");
  });
});
