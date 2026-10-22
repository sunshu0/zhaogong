import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("security headers (security review)", () => {
  it("go on every path: no framing by other sites, no type sniffing, only our origin as the referrer", async () => {
    const rules = await nextConfig.headers!();
    expect(rules.map((r) => r.source)).toEqual(["/:path*"]);
    expect(Object.fromEntries(rules[0].headers.map((h) => [h.key, h.value]))).toEqual({
      "Content-Security-Policy": "frame-ancestors 'none'",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
  });
});
