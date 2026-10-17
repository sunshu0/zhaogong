import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { devHelpersOn } from "@/lib/test-build";
import { canSendCodes } from "@/lib/auth/delivery";
import { devRepliesEnabled } from "@/lib/chat-server/dev";
import { assistantKind } from "@/lib/ai-post/model";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("the browser tests' build (#139)", () => {
  it("turns the development helpers on outside production, and in production only with ZG_E2E=1", () => {
    expect(devHelpersOn("development", undefined)).toBe(true);
    expect(devHelpersOn("test", undefined)).toBe(true);
    expect(devHelpersOn("production", undefined)).toBe(false);
    expect(devHelpersOn("production", "0")).toBe(false);
    expect(devHelpersOn("production", "true")).toBe(false);
    expect(devHelpersOn("production", "1")).toBe(true);
  });

  it("leaves production as it was without the switch: no codes on the page, no dev routes, no script", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ZG_E2E", "");
    expect(canSendCodes()).toBe(false);
    expect(devRepliesEnabled()).toBe(false);
    expect(assistantKind({ NODE_ENV: "production" })).toBe("unavailable");
    expect(assistantKind({ NODE_ENV: "production", ZG_E2E: "0" }, true)).toBe("unavailable");

    vi.stubEnv("ZG_E2E", "1");
    expect(canSendCodes()).toBe(true);
    expect(devRepliesEnabled()).toBe(true);
    expect(assistantKind({ NODE_ENV: "production", ZG_E2E: "1" })).toBe("script");
    expect(assistantKind({ NODE_ENV: "production", ZG_E2E: "1" }, true)).toBe("fake");
  });

  it("is fixed at build time: a build without ZG_E2E writes 0 into the code, a test build 1 and its own folder", async () => {
    vi.stubEnv("ZG_E2E", "");
    const plain = (await import("../../next.config")).default;
    expect(plain.env).toEqual({ ZG_E2E: "0" });
    expect(plain.distDir).toBeUndefined();

    vi.resetModules();
    vi.stubEnv("ZG_E2E", "1");
    const test = (await import("../../next.config")).default;
    expect(test.env).toEqual({ ZG_E2E: "1" });
    expect(test.distDir).toBe(".next-e2e");
    expect(test.typescript?.tsconfigPath).toBe("tsconfig.e2e.json");
  });

  it("refuses to make the Cloudflare build a test build", async () => {
    vi.stubEnv("ZG_E2E", "1");
    vi.stubEnv("NEXT_PRIVATE_STANDALONE", "true");
    await expect(import("../../next.config")).rejects.toThrow(/browser tests' build only/);
  });

  it("is set by no deployment configuration", () => {
    expect(readFileSync("wrangler.jsonc", "utf8")).not.toMatch(/ZG_E2E/);
    const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts as Record<string, string>;
    for (const [name, command] of Object.entries(scripts)) {
      if (!name.startsWith("e2e:")) expect(command, name).not.toMatch(/ZG_E2E|e2e-server/);
    }
  });
});
