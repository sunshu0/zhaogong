import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";

// The day a mail service is added, production can send codes. This file stands one in, so the rule is checked
// for that case too: the code goes to the mailbox only, never back to the sign-in page.
const sent: { email: string; code: string }[] = [];
/** Whether the stand-in mail service takes the next email (#16: SES can refuse or be down). */
let mailerUp = true;
vi.mock("@/lib/auth/delivery", () => ({
  canSendCodes: () => true,
  sendSignInCode: async (email: string, code: string) => mailerUp && sent.push({ email, code }) > 0,
}));

const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar, headers: async () => new Headers() }));

const { requestSignInCode, signInAccount } = await import("@/app/[lang]/login/actions");

beforeEach(() => {
  setAuthStoreForTests();
  cookies.clear();
  sent.length = 0;
  mailerUp = true;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("验证码 with a mail service", () => {
  it("in production: mailed, not returned to the page, and the mailed code signs in", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "production secret");
    const result = await requestSignInCode("mail@example.com");
    expect(result).toEqual({ ok: true, resendInSec: 60, validMinutes: 10 });
    expect(result).not.toHaveProperty("devCode");
    expect(sent).toEqual([{ email: "mail@example.com", code: expect.stringMatching(/^\d{6}$/) }]);
    expect(await signInAccount("mail@example.com", sent[0].code, "seeker")).toMatchObject({ ok: true });
  });

  it("in production when the mail service fails: says to try again later, and trying again works at once", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_SECRET", "production secret");
    mailerUp = false;
    expect(await requestSignInCode("down@example.com")).toEqual({ ok: false, error: "验证码没有发出去，请稍后再试" });
    mailerUp = true;
    expect(await requestSignInCode("down@example.com")).toEqual({ ok: true, resendInSec: 60, validMinutes: 10 });
    expect(sent).toHaveLength(1);
  });

  it("in development: the same code also comes back for the page to show", async () => {
    const result = await requestSignInCode("dev@example.com");
    expect(result).toEqual({ ok: true, devCode: sent[0].code, resendInSec: 60, validMinutes: 10 });
  });
});
