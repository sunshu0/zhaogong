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
  sessionCookieName,
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
  vi.unstubAllGlobals();
});

/** Production with the four SES settings (#16); `answer` is what SES says to the send. */
function productionWithSes(answer: () => Response) {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("AUTH_SECRET", "production secret");
  vi.stubEnv("SES_REGION", "ap-southeast-2");
  vi.stubEnv("MAIL_FROM", "找工 <no-reply@example.com>");
  vi.stubEnv("SES_ACCESS_KEY_ID", "AKIDEXAMPLE");
  vi.stubEnv("SES_SECRET_ACCESS_KEY", "secret-example");
  const sent: Request[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      sent.push(request);
      return answer();
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  return sent;
}

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

  it("give guesses sent all at once five tries between them, not five each (security review)", async () => {
    const { devCode } = (await requestCode("k@example.com", t0)) as { devCode: string };
    const guesses = Array.from({ length: 30 }, (_, i) =>
      String((Number(devCode) + 1 + i) % 1_000_000).padStart(6, "0"),
    );
    const results = await Promise.all(guesses.map((g) => verifyCode("k@example.com", g, later(1000))));
    expect(results.filter((r) => r.ok)).toEqual([]);
    expect(results.filter((r) => !r.ok && r.reason === "wrong")).toHaveLength(MAX_ATTEMPTS - 1);
    expect(store.codes.get("k@example.com")?.attempts).toBe(MAX_ATTEMPTS);
    expect(await verifyCode("k@example.com", devCode, later(2000))).toEqual({ ok: false, reason: "too_many" });
  });

  it("sign in once when the right code is sent twice at once", async () => {
    const { devCode } = (await requestCode("m@example.com", t0)) as { devCode: string };
    const both = await Promise.all([1, 2].map(() => verifyCode("m@example.com", devCode, later(1000))));
    expect(both.filter((r) => r.ok)).toHaveLength(1);
    expect(both.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "no_code" }]);
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

  it("in production with SES set up: the code is mailed, not printed or given back to the page (#16)", async () => {
    const sent = productionWithSes(() => Response.json({ MessageId: "m-1" }));
    expect(await requestCode("Mei@Example.com", t0, "en")).toEqual({ ok: true });
    expect(sent).toHaveLength(1);
    const body = JSON.parse(await sent[0].text());
    expect(body.Destination).toEqual({ ToAddresses: ["mei@example.com"] });
    expect(body.Content.Simple.Subject.Data).toMatch(/^Your 找工 sign-in code: [0-9]{6}$/);
    expect(console.info).not.toHaveBeenCalled();
    expect(store.codes.has("mei@example.com")).toBe(true);
  });

  it("in production when SES does not take it: says so, drops the code, and asking again works at once", async () => {
    productionWithSes(() => new Response("{}", { status: 503, headers: { "x-amzn-errortype": "ServiceUnavailable" } }));
    expect(await requestCode("lin@example.com", t0)).toEqual({ ok: false, reason: "send_failed" });
    expect(store.codes.size).toBe(0);
    expect(console.error).toHaveBeenCalledWith("[auth] sign-in code not sent: SES 503 ServiceUnavailable");
    expect(String(vi.mocked(console.error).mock.calls)).not.toContain("lin@example.com");
    expect(await requestCode("lin@example.com", later(1000))).toEqual({ ok: false, reason: "send_failed" });
  });

  it("in production without AUTH_SECRET: refuse to hash at all", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => hashCode("h@example.com", "123456")).toThrow(/AUTH_SECRET/);
  });
});

describe("clearing what has ended while someone signs in (security review H)", () => {
  it("deletes ended sessions and codes a day past their end when a code is asked for or checked; keeps the rest", async () => {
    const day = 24 * 3600_000;
    await account("ended@example.com");
    await account("live@example.com");
    await createSession("ended@example.com", "seeker", fakeJar().jar, t0); // ends at t0 + 30 days
    await createSession("live@example.com", "seeker", fakeJar().jar, later(20 * day)); // ends at t0 + 50 days
    await requestCode("gone@example.com", t0); // expires 10 minutes later
    const T = later(31 * day);
    const { devCode: lateCode } = (await requestCode("late@example.com", new Date(T.getTime() - 3600_000))) as {
      devCode: string;
    };

    await requestCode("asks@example.com", T);
    expect([...store.sessions.values()].map((s) => s.email)).toEqual(["live@example.com"]);
    expect([...store.codes.keys()].sort()).toEqual(["asks@example.com", "late@example.com"]);
    // Expired 50 minutes ago: kept, so checking it still says it expired.
    expect(await verifyCode("late@example.com", lateCode, T)).toEqual({ ok: false, reason: "expired" });

    // Checking a code clears on its own too: an old code and an ended session put in after the last request.
    const U = later(33 * day);
    const { devCode } = (await requestCode("checks@example.com", U)) as { devCode: string };
    store.codes.set("old@example.com", {
      ...store.codes.get("checks@example.com")!,
      email: "old@example.com",
      expiresAt: T.toISOString(),
    });
    store.sessions.set("x".repeat(64), {
      ...[...store.sessions.values()][0],
      id: "x".repeat(64),
      expiresAt: U.toISOString(),
    });
    expect(await verifyCode("checks@example.com", devCode, new Date(U.getTime() + 1000))).toEqual({ ok: true });
    expect(store.codes.has("old@example.com")).toBe(false);
    expect([...store.sessions.keys()]).not.toContain("x".repeat(64));
    expect([...store.sessions.values()].map((s) => s.email)).toEqual(["live@example.com"]);
  });
});

describe("sessions", () => {
  it("live behind an httpOnly, SameSite=Lax cookie for 30 days, holding 32 random bytes", async () => {
    await account("s1@example.com");
    const { jar, values, options } = fakeJar();
    const view = await createSession("s1@example.com", "seeker", jar, t0);
    expect(view).toEqual({ email: "s1@example.com", activeRole: "seeker" });

    const token = values.get(sessionCookieName())!;
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(options.get(sessionCookieName())).toMatchObject({
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

  it("in production are __Host-zg_session: Secure, Path=/, no Domain, the rest unchanged (review I)", async () => {
    await account("s2@example.com");
    expect(sessionCookieName()).toBe("zg_session"); // development and these tests: plain http
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "production secret");
    expect(sessionCookieName()).toBe("__Host-zg_session");
    const { jar, values, options } = fakeJar();
    await createSession("s2@example.com", "seeker", jar, t0);
    expect(values.has("zg_session")).toBe(false);
    const set = options.get("__Host-zg_session")!;
    expect(set).toMatchObject({ httpOnly: true, sameSite: "lax", secure: true, path: "/" });
    expect(set).not.toHaveProperty("domain");
    expect(await getCurrentSession(jar)).toEqual({ email: "s2@example.com", activeRole: "seeker" });

    // Sign-out replaces it with an expired one with the same options: a __Host- cookie is only cleared by a Secure one.
    await signOut(jar);
    expect(values.get("__Host-zg_session")).toBe("");
    expect(options.get("__Host-zg_session")).toMatchObject({ secure: true, path: "/", maxAge: 0 });
    expect(await getCurrentSession(jar)).toBeNull();
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
    jar.set(sessionCookieName(), Buffer.alloc(32, 7).toString("base64url"), {});
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

  it("end on sign-out: row gone, cookie expired", async () => {
    await account("s5@example.com");
    const { jar, values, options } = fakeJar();
    await createSession("s5@example.com", "seeker", jar, t0);
    await signOut(jar);
    expect(values.get(sessionCookieName())).toBe("");
    expect(options.get(sessionCookieName())).toMatchObject({ maxAge: 0 });
    expect(store.sessions.size).toBe(0);
    expect(await getCurrentSession(jar)).toBeNull();
  });
});
