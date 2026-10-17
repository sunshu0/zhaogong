import { afterEach, describe, expect, it, vi } from "vitest";
import { crashForTests, TEST_CRASH_KEY } from "./test-crash";

function browserAsking(part: string | null) {
  vi.stubGlobal("window", { localStorage: { getItem: (k: string) => (k === TEST_CRASH_KEY ? part : null) } });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("crashForTests", () => {
  it("does nothing outside the browser tests' build, even when asked", () => {
    vi.stubEnv("ZG_E2E", "0");
    browserAsking("post");
    expect(() => crashForTests("post")).not.toThrow();
  });

  it("in the tests' build, throws only for the part the test named", () => {
    vi.stubEnv("ZG_E2E", "1");
    browserAsking("post");
    expect(() => crashForTests("post")).toThrow(/Test crash in post/);
    expect(() => crashForTests("chat")).not.toThrow();
    browserAsking(null);
    expect(() => crashForTests("post")).not.toThrow();
  });

  it("does nothing while rendering on the server", () => {
    vi.stubEnv("ZG_E2E", "1");
    expect(() => crashForTests("post")).not.toThrow();
  });
});
