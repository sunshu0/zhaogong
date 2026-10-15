import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryAuthStore, setAuthStoreForTests } from "@/lib/auth/store";
import { createEmployer, ensureAccount, openEmployerIdentity } from "@/lib/data";
import {
  AuthError,
  CODE_TTL_MS,
  createSession,
  generateCode,
  getCurrentSession,
  hashCode,
  MAX_ATTEMPTS,
  requestCode,
  requireEmployer,
  requireSession,
  RESEND_AFTER_MS,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  signOut,
  switchRole,
  verifyCode,
  type CookieJar,
} from "@/lib/auth";

/** A cookie jar that remembers what was set, with the options, like Next's cookies(). */
function fakeJar() {
  const values = new Map<string, string>();
  const options = new Map<string, Record<string, unknown>>();
  const jar: CookieJar = {
    get: (name) => (values.has(name) ? { name, value: values.get(name)! } : undefined),
    set: (name, value, opts) => {
      values.set(name, value);
      options.set(name, { ...opts });
    },
    delete: (name) => {
      values.delete(name);
      options.delete(name);
    },
  };
  return { jar, values, options };
}

/** Sessions belong to accounts, which data.ts keeps. */
async function account(email: string) {
  await ensureAccount(email);
}

const t0 = new Date("2026-10-13T01:00:00.000Z");
const later = (ms: number) => new Date(t0.getTime() + ms);

let store = memoryAuthStore();

beforeEach(() => {
  store = memoryAuthStore();
  setAuthStoreForTests(store);
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("sign-in codes", () => {
  it("are six digits from crypto.randomInt", () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^[0-9]{6}$/);
  });

  it("are stored as an HMAC-SHA256 with AUTH_SECRET, never as the code", async () => {
    const result = await requestCode("Li@Example.com", t0);
    expect(result).toEqual({ ok: true, devCode: expect.stringMatching(/^[0-9]{6}$/) });
    const row = store.codes.get("li@example.com")!;
    const code = (result as { devCode: string }).devCode;
    expect(row.codeHash).not.toContain(code);
    expect(row.codeHash).toBe(hashCode("li@example.com", code));
    expect(row.codeHash).toMatch(/^[0-9a-f]{64}$/);
    vi.stubEnv("AUTH_SECRET", "another secret");
    expect(hashCode("li@example.com", code)).not.toBe(row.codeHash);
  });

  it("sign in once with the right code; the code then stops working", async () => {
    const { devCode } = (await requestCode("a@example.com", t0)) as { devCode: string };
    expect(await verifyCode("a@example.com", devCode, later(60_000))).toEqual({ ok: true });
    expect(await verifyCode("a@example.com", devCode, later(61_000))).toEqual({ ok: false, reason: "no_code" });
  });

  it("refuse a wrong code and count the tries; after five, even the right code is refused", async () => {
    const { devCode } = (await requestCode("b@example.com", t0)) as { devCode: string };
    const wrong = devCode === "000000" ? "111111" : "000000";
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      expect(await verifyCode("b@example.com", wrong, later(i * 1000))).toEqual({
        ok: false,
        reason: "wrong",
        attemptsLeft: MAX_ATTEMPTS - i,
      });
    }
    expect(await verifyCode("b@example.com", wrong, later(9_000))).toEqual({ ok: false, reason: "too_many" });
    expect(await verifyCode("b@example.com", devCode, later(10_000))).toEqual({ ok: false, reason: "too_many" });
    expect(await verifyCode("b@example.com", "12ab56", later(11_000))).toEqual({ ok: false, reason: "too_many" });
  });

  it("expire after 10 minutes", async () => {
    const { devCode } = (await requestCode("c@example.com", t0)) as { devCode: string };
    expect(CODE_TTL_MS).toBe(10 * 60_000);
    expect(await verifyCode("c@example.com", devCode, later(CODE_TTL_MS))).toEqual({ ok: false, reason: "expired" });
  });

  it("can be sent again only after 60 seconds, and a new code replaces the old one", async () => {
    const first = (await requestCode("d@example.com", t0)) as { devCode: string };
    expect(RESEND_AFTER_MS).toBe(60_000);
    expect(await requestCode("d@example.com", later(30_000))).toEqual({
      ok: false,
      reason: "throttled",
      retryAfterSec: 30,
    });
    const second = (await requestCode("d@example.com", later(61_000))) as { devCode: string };
    expect(second.devCode).toMatch(/^[0-9]{6}$/);
    if (second.devCode !== first.devCode) {
      expect((await verifyCode("d@example.com", first.devCode, later(62_000))).ok).toBe(false);
    }
    expect(await verifyCode("d@example.com", second.devCode, later(63_000))).toEqual({ ok: true });
  });

  it("the resend wait still applies after five wrong tries", async () => {
    await requestCode("e@example.com", t0);
    for (let i = 0; i < MAX_ATTEMPTS; i++) await verifyCode("e@example.com", "not-it", later(1000 + i));
    expect((await requestCode("e@example.com", later(10_000))).ok).toBe(false);
    expect((await requestCode("e@example.com", later(RESEND_AFTER_MS + 1))).ok).toBe(true);
  });

  it("in development: the code goes to the server log and back to the sign-in page", async () => {
    const result = await requestCode("f@example.com", t0);
    expect(console.info).toHaveBeenCalledWith(expect.stringContaining((result as { devCode: string }).devCode));
  });

  it("in production with no mail service: refuse, print nothing, store nothing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "production secret");
    expect(await requestCode("g@example.com", t0)).toEqual({ ok: false, reason: "no_mailer" });
    expect(console.info).not.toHaveBeenCalled();
    expect(store.codes.size).toBe(0);
  });

  it("in production without AUTH_SECRET: refuse to hash at all", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => hashCode("h@example.com", "123456")).toThrow(/AUTH_SECRET/);
  });
});

describe("sessions", () => {
  it("live behind an httpOnly, SameSite=Lax cookie for 30 days, holding 32 random bytes", async () => {
    await account("s1@example.com");
    const { jar, values, options } = fakeJar();
    const view = await createSession("s1@example.com", "seeker", jar, t0);
    expect(view).toEqual({ email: "s1@example.com", activeRole: "seeker" });

    const token = values.get(SESSION_COOKIE)!;
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(options.get(SESSION_COOKIE)).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
      expires: later(SESSION_TTL_MS),
    });
    expect(SESSION_TTL_MS).toBe(30 * 24 * 3600_000);

    // The store keeps a hash of the cookie, so a copy of it cannot sign anyone in.
    const rows = [...store.sessions.values()];
    expect(rows).toHaveLength(1);
    expect(rows[0].id).not.toBe(token);
    expect(rows[0].id).toBe(createHash("sha256").update(token).digest("hex"));
  });

  it("set Secure on the cookie in production", async () => {
    await account("s2@example.com");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "production secret");
    const { jar, options } = fakeJar();
    await createSession("s2@example.com", "seeker", jar, t0);
    expect(options.get(SESSION_COOKIE)?.secure).toBe(true);
  });

  it("are read back from the cookie, and end after 30 days", async () => {
    await account("s3@example.com");
    const { jar } = fakeJar();
    await createSession("s3@example.com", "seeker", jar, t0);
    expect(await getCurrentSession(jar, later(1000))).toEqual({ email: "s3@example.com", activeRole: "seeker" });
    expect(await getCurrentSession(jar, later(SESSION_TTL_MS))).toBeNull();
    expect(store.sessions.size).toBe(0);
  });

  it("know nothing of a cookie the server did not issue", async () => {
    const { jar } = fakeJar();
    jar.set(SESSION_COOKIE, Buffer.alloc(32, 7).toString("base64url"), {});
    expect(await getCurrentSession(jar)).toBeNull();
    await expect(requireSession(jar)).rejects.toThrow(AuthError);
  });

  it("switch identity only to an employer identity the account really has", async () => {
    await account("s4@example.com");
    const { jar } = fakeJar();
    await createSession("s4@example.com", "employer", jar, t0); // no business yet
    expect((await getCurrentSession(jar))?.activeRole).toBe("seeker");
    expect(await switchRole("employer", jar)).toEqual({ email: "s4@example.com", activeRole: "seeker" });
    await expect(requireEmployer(jar)).rejects.toThrow(AuthError);

    const shop = await createEmployer({ name: "测试面馆", regionId: "akl-cbd" });
    expect((await openEmployerIdentity("s4@example.com", shop.id)).ok).toBe(true);
    const employer = { id: shop.id, name: "测试面馆" };
    expect(await switchRole("employer", jar)).toEqual({ email: "s4@example.com", activeRole: "employer", employer });
    expect(await requireEmployer(jar)).toMatchObject({ email: "s4@example.com", employer: { id: shop.id } });
    expect(await switchRole("seeker", jar)).toEqual({ email: "s4@example.com", activeRole: "seeker", employer });
    const [row] = [...store.sessions.values()];
    expect(row.activeRole).toBe("seeker");
  });

  it("end on sign-out: row and cookie gone", async () => {
    await account("s5@example.com");
    const { jar, values } = fakeJar();
    await createSession("s5@example.com", "seeker", jar, t0);
    await signOut(jar);
    expect(values.has(SESSION_COOKIE)).toBe(false);
    expect(store.sessions.size).toBe(0);
    expect(await getCurrentSession(jar)).toBeNull();
  });
});
