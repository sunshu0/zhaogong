import { afterEach, describe, expect, it, vi } from "vitest";
import { signInNoticeFor } from "@/lib/auth/notice";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

afterEach(() => vi.unstubAllEnvs());

describe("signInNoticeFor (user feedback 10-30 #1)", () => {
  it("is closed in production with no mail service, whatever the list", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(signInNoticeFor({})).toBe("closed");
    expect(signInNoticeFor({ SIGN_IN_ALLOWLIST: "me@example.com" })).toBe("closed");
  });

  it("is by invitation while SIGN_IN_ALLOWLIST is set, and nothing when anyone may sign in", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SES_REGION", "ap-southeast-2");
    vi.stubEnv("MAIL_FROM", "找工 <no-reply@example.com>");
    vi.stubEnv("SES_ACCESS_KEY_ID", "AKIDEXAMPLE");
    vi.stubEnv("SES_SECRET_ACCESS_KEY", "secret-example");
    expect(signInNoticeFor({ SIGN_IN_ALLOWLIST: " Me@Example.com " })).toBe("invited");
    expect(signInNoticeFor({ SIGN_IN_ALLOWLIST: "" })).toBeUndefined();
    expect(signInNoticeFor({})).toBeUndefined();
  });
});
