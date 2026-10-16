import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";

const page = (cookie?: string) =>
  new NextRequest("http://localhost/jobs/j2", cookie ? { headers: { cookie } } : undefined);

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

  it("runs only for job pages", () => {
    expect(config.matcher).toBe("/jobs/:id");
  });
});
