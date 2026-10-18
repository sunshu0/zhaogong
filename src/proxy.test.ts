import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";

const request = (path: string, cookie?: string, method = "GET") =>
  new NextRequest(`http://localhost${path}`, { method, ...(cookie ? { headers: { cookie } } : {}) });
const page = (cookie?: string) => request("/jobs/j2", cookie);
const rewrittenTo = (response: Response) => response.headers.get("x-middleware-rewrite");

describe("proxy: the visitor id comes with the job page (#79)", () => {
  it("gives a browser without one a random httpOnly id for a year", () => {
    const set = proxy(page()).cookies.get("zg_visitor");
    expect(set?.value).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(set).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 365 * 24 * 3600 });
    expect(proxy(page()).cookies.get("zg_visitor")?.value).not.toBe(set?.value);
  });

  it("leaves a browser's id alone, and replaces one that is not an id", () => {
    expect(proxy(page("zg_visitor=AAAAAAAAAAAAAAAAAAAAAA")).cookies.get("zg_visitor")).toBeUndefined();
    expect(proxy(page("zg_visitor=../../etc")).cookies.get("zg_visitor")?.value).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("only on a job page, and only with the page itself (GET)", () => {
    expect(proxy(request("/jobs")).cookies.get("zg_visitor")).toBeUndefined();
    expect(proxy(request("/jobs/j2/x")).cookies.get("zg_visitor")).toBeUndefined();
    expect(proxy(request("/jobs/j2", undefined, "POST")).cookies.get("zg_visitor")).toBeUndefined();
  });
});

describe("proxy: the interface language (Round 20, ADR 0023)", () => {
  it("serves the copy in the cookie's language, Chinese without one, at the same address", () => {
    expect(rewrittenTo(proxy(request("/jobs?q=厨师")))).toBe("http://localhost/zh/jobs?q=%E5%8E%A8%E5%B8%88");
    expect(rewrittenTo(proxy(request("/jobs", "zg_lang=en")))).toBe("http://localhost/en/jobs");
    expect(rewrittenTo(proxy(request("/", "zg_lang=en")))).toBe("http://localhost/en");
    expect(rewrittenTo(proxy(request("/me", "zg_lang=fr")))).toBe("http://localhost/zh/me");
    expect(rewrittenTo(proxy(request("/jobs/j2", "zg_lang=en", "POST")))).toBe("http://localhost/en/jobs/j2");
  });

  it("sends an address with a language back to the plain one, for good", () => {
    const response = proxy(request("/en/jobs?q=x", "zg_lang=en"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("http://localhost/jobs?q=x");
    expect(proxy(request("/zh")).headers.get("location")).toBe("http://localhost/");
  });

  it("runs for every page and other dotted addresses, not for Next's files, the API or the files in public/", () => {
    const [matcher] = config.matcher;
    const runs = (path: string) => new RegExp(`^${matcher}$`).test(path);
    for (const path of ["/", "/jobs", "/jobs/j2", "/me/saved", "/external/demo-kowhai:4002", "/en/jobs"])
      expect(runs(path), path).toBe(true);
    // No file behind these: through the proxy to [lang]/[...missing], a 404 in the cookie's language.
    for (const path of ["/favicon.ico", "/ads.txt", "/jobs/a.b", "/wp-login.php"]) expect(runs(path), path).toBe(true);
    for (const path of ["/_next/static/chunks/a.js", "/api/dev/job-closing", "/robots.txt", "/sitemap.xml"])
      expect(runs(path), path).toBe(false);
    // A public file the proxy rewrote to /zh/… would be a 404: a new kind of file needs adding to the matcher.
    const files = readdirSync("public", { recursive: true, withFileTypes: true }).filter(
      (f) => f.isFile() && !f.name.startsWith("_"),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const path = "/" + relative("public", join(f.parentPath, f.name)).replaceAll("\\", "/");
      expect(runs(path), path).toBe(false);
    }
  });
});
