import { afterEach, describe, expect, it, vi } from "vitest";
import { TEST_EVENTS_SECRET, eventsSecret, visitorKey } from "@/lib/events/visitor-key";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the visitor column (#312, ADR 0025 §3)", () => {
  it("joins a browser up within a day, not across days, and not without the key", () => {
    const id = "AAAAAAAAAAAAAAAAAAAAAA";
    const today = visitorKey(id, "2026-10-20", "k");
    expect(today).toMatch(/^[0-9a-f]{64}$/);
    expect(visitorKey(id, "2026-10-20", "k")).toBe(today);
    expect(visitorKey(id, "2026-10-21", "k")).not.toBe(today);
    expect(visitorKey(id, "2026-10-20", "other key")).not.toBe(today);
    expect(visitorKey("BBBBBBBBBBBBBBBBBBBBBB", "2026-10-20", "k")).not.toBe(today);
  });

  it("uses ZG_EVENTS_SECRET when it is set", () => {
    expect(eventsSecret({ ZG_EVENTS_SECRET: "real" })).toBe("real");
  });

  it("falls back to the test key in development, unit tests and the test build", () => {
    expect(eventsSecret({})).toBe(TEST_EVENTS_SECRET);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ZG_E2E", "1");
    expect(eventsSecret({})).toBe(TEST_EVENTS_SECRET);
  });

  it("records nothing in production without a key, and says so in the log", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ZG_E2E", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(eventsSecret({})).toBeNull();
    expect(warn.mock.calls[0]?.[0]).toMatch(/ZG_EVENTS_SECRET is not set/);
  });
});
