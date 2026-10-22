// The sign-in limits of ADR 0033: per network, per email and for the whole site, on top of one code a minute per
// email and five tries per code.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryAuthStore, setAuthStoreForTests } from "@/lib/auth/store";
import { requestCode, takeLimits, verifyCode } from "@/lib/auth/codes";
import { clientIp, LIMITS, limitWindow, siteFuseOn } from "@/lib/auth/limits";
import { RESEND_AFTER_MS } from "@/lib/auth/config";

const t0 = new Date("2026-10-23T00:00:00.000Z");
const later = (ms: number) => new Date(t0.getTime() + ms);
const HOUR = 3600_000;

let store = memoryAuthStore();

beforeEach(() => {
  store = memoryAuthStore();
  setAuthStoreForTests(store);
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("limit windows", () => {
  it("share a key within a window and start over in the next; the key holds no IP or email", () => {
    const a = limitWindow("emailCodes", "li@example.com", later(1000));
    expect(limitWindow("emailCodes", "li@example.com", later(23 * HOUR)).key).toBe(a.key);
    expect(limitWindow("emailCodes", "li@example.com", later(24 * HOUR)).key).not.toBe(a.key);
    expect(limitWindow("emailChecks", "li@example.com", later(1000)).key).not.toBe(a.key);
    expect(limitWindow("emailCodes", "wang@example.com", later(1000)).key).not.toBe(a.key);
    expect(a.key).toMatch(/^[0-9a-f]{64}$/);
    expect(a.expiresAt).toBe(later(24 * HOUR).toISOString());
    expect(a.retryAfterSec).toBe(24 * 3600 - 1);
    expect(limitWindow("ipCodes", "203.0.113.7", later(HOUR - 500)).retryAfterSec).toBe(1);
  });

  it("read the IP Cloudflare passes on, and nothing that does not look like one", () => {
    expect(clientIp(" 203.0.113.7 ")).toBe("203.0.113.7");
    expect(clientIp("2001:DB8::1")).toBe("2001:db8::1");
    expect(clientIp(undefined)).toBeUndefined();
    expect(clientIp("")).toBeUndefined();
    expect(clientIp("203.0.113.7, 198.51.100.1")).toBeUndefined();
    expect(clientIp("x".repeat(46))).toBeUndefined();
  });

  it("keep the site-wide fuse off where no mail is sent (development, the browser tests' build)", () => {
    expect(siteFuseOn(true)).toBe(false);
    expect(siteFuseOn(false)).toBe(true);
  });
});

describe("asking for codes", () => {
  it("sends one email at most ten codes in 24 hours, then says how long until it can again", async () => {
    for (let i = 0; i < LIMITS.emailCodes.max; i++) {
      expect((await requestCode("li@example.com", later(i * RESEND_AFTER_MS))).ok).toBe(true);
    }
    const at = later(LIMITS.emailCodes.max * RESEND_AFTER_MS);
    expect(await requestCode("li@example.com", at)).toEqual({
      ok: false,
      reason: "limited",
      scope: "email",
      retryAfterSec: (24 * HOUR - LIMITS.emailCodes.max * RESEND_AFTER_MS) / 1000,
    });
    expect((await requestCode("wang@example.com", at)).ok).toBe(true); // another email is not held up
    expect((await requestCode("li@example.com", later(24 * HOUR))).ok).toBe(true); // the next day
  });

  it("lets one network ask for at most twenty codes an hour, whatever the emails; no IP, no network limit", async () => {
    const ip = "203.0.113.7";
    const asks = await Promise.all(
      Array.from({ length: 30 }, (_, i) => requestCode(`u${i}@example.com`, later(1000), "zh", { ip })),
    );
    expect(asks.filter((r) => r.ok)).toHaveLength(LIMITS.ipCodes.max);
    expect(asks.filter((r) => !r.ok)).toEqual(
      Array(30 - LIMITS.ipCodes.max).fill({ ok: false, reason: "limited", scope: "ip", retryAfterSec: 3599 }),
    );
    expect((await requestCode("other@example.com", later(2000), "zh", { ip: "198.51.100.1" })).ok).toBe(true);
    expect((await requestCode("no-ip@example.com", later(2000))).ok).toBe(true);
    expect((await requestCode("next-hour@example.com", later(HOUR), "zh", { ip })).ok).toBe(true);
  });

  it("does not count asking again within the minute, which is refused before the limits", async () => {
    await requestCode("li@example.com", t0);
    for (let i = 1; i <= 30; i++) {
      expect(await requestCode("li@example.com", later(i * 1000))).toMatchObject({ reason: "throttled" });
    }
    expect([...store.limits.values()].map((row) => row.count)).toEqual([1]);
  });

  it("stops every code past the site-wide fuse, from any network or email", async () => {
    for (let i = 0; i < LIMITS.siteCodes.max; i++) {
      expect(await takeLimits(store, [{ name: "siteCodes" }], later(1000))).toBeUndefined();
    }
    expect(await takeLimits(store, [{ name: "siteCodes" }], later(2000))).toEqual({
      ok: false,
      reason: "limited",
      scope: "site",
      retryAfterSec: 3598,
    });
  });

  it("clears the counts of windows that have ended", async () => {
    await requestCode("li@example.com", t0, "zh", { ip: "203.0.113.7" });
    expect(store.limits.size).toBe(2);
    await requestCode("wang@example.com", later(25 * HOUR));
    expect(store.limits.size).toBe(1);
  });
});

describe("checking codes", () => {
  it("checks at most twenty codes for one email in 24 hours, without using the code's own tries", async () => {
    const { devCode } = (await requestCode("li@example.com", t0)) as { devCode: string };
    const full = limitWindow("emailChecks", "li@example.com", later(1000));
    for (let i = 0; i < LIMITS.emailChecks.max; i++)
      await store.takeLimit(full.key, LIMITS.emailChecks.max, full.expiresAt);
    expect(await verifyCode("li@example.com", devCode, later(1000))).toMatchObject({
      ok: false,
      reason: "limited",
      scope: "email",
    });
    expect(store.codes.get("li@example.com")?.attempts).toBe(0);
  });

  it("checks at most sixty codes an hour from one network", async () => {
    const ip = "203.0.113.7";
    const full = limitWindow("ipChecks", ip, later(1000));
    for (let i = 0; i < LIMITS.ipChecks.max; i++) await store.takeLimit(full.key, LIMITS.ipChecks.max, full.expiresAt);
    const { devCode } = (await requestCode("li@example.com", t0)) as { devCode: string };
    expect(await verifyCode("li@example.com", devCode, later(1000), { ip })).toMatchObject({ scope: "ip" });
    expect(await verifyCode("li@example.com", devCode, later(2000), { ip: "198.51.100.1" })).toEqual({ ok: true });
  });

  it("clears the counts of windows that have ended when a code is checked, too", async () => {
    await requestCode("li@example.com", t0, "zh", { ip: "203.0.113.7" });
    const { devCode } = (await requestCode("wang@example.com", later(25 * HOUR))) as { devCode: string };
    store.limits.set("ended", { count: 1, expiresAt: later(25 * HOUR).toISOString() });
    await verifyCode("wang@example.com", devCode, later(25 * HOUR + 1000));
    expect(store.limits.has("ended")).toBe(false);
  });

  it("does not count a check when there is no live code to check", async () => {
    expect(await verifyCode("nobody@example.com", "123456", t0)).toEqual({ ok: false, reason: "no_code" });
    expect(store.limits.size).toBe(0);
  });
});
