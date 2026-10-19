import { describe, expect, it } from "vitest";
import { isBotOrPrefetch } from "@/lib/events/request";

const h = (init: Record<string, string>) => new Headers(init);

describe("requests that never make an event (#312, ADR 0025 §4)", () => {
  it("knows crawlers by their User-Agent", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (compatible; bingbot/2.0)",
      "Baiduspider+(+http://www.baidu.com/search/spider.htm)",
      "facebookexternalhit/1.1",
      "Mozilla/5.0 (Linux; Android 11) Chrome-Lighthouse",
    ])
      expect(isBotOrPrefetch(h({ "user-agent": ua }))).toBe(true);
  });

  it("knows Next's and the browser's prefetches", () => {
    expect(isBotOrPrefetch(h({ "next-router-prefetch": "1" }))).toBe(true);
    expect(isBotOrPrefetch(h({ purpose: "prefetch" }))).toBe(true);
    expect(isBotOrPrefetch(h({ "sec-purpose": "prefetch;prerender" }))).toBe(true);
  });

  it("lets people through, and the browser tests' headless Chromium too", () => {
    expect(
      isBotOrPrefetch(
        h({ "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15" }),
      ),
    ).toBe(false);
    expect(isBotOrPrefetch(h({ "user-agent": "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/141.0.0.0" }))).toBe(
      false,
    );
    expect(isBotOrPrefetch(h({}))).toBe(false);
  });
});
