import { describe, expect, it } from "vitest";
import { PRIVATE_PATHS, robotsRules, siteOrigin, sitemapEntries } from "@/lib/site";
import type { Employer, Job } from "@/lib/types";

const now = Date.parse("2026-10-16T00:00:00.000Z");
const job = (id: string, employerId: string, patch: Partial<Job> = {}) =>
  ({
    id,
    employerId,
    status: "active",
    postedAt: "2026-10-10T00:00:00.000Z",
    expiresAt: "2026-11-01T00:00:00.000Z",
    ...patch,
  }) as Job;
const employer = (id: string, patch: Partial<Employer> = {}) => ({ id, name: id, ...patch }) as Employer;

describe("siteOrigin", () => {
  it("uses SITE_URL when set, without a trailing slash", () => {
    expect(siteOrigin("https://zhaogong.nz/", "x.workers.dev", "https")).toBe("https://zhaogong.nz");
  });

  it("otherwise uses the request's host: https, or http on localhost", () => {
    expect(siteOrigin(undefined, "zhaogong-demo.zhaogong.workers.dev", null)).toBe(
      "https://zhaogong-demo.zhaogong.workers.dev",
    );
    expect(siteOrigin(undefined, "localhost:8704", null)).toBe("http://localhost:8704");
    expect(siteOrigin(undefined, "example.org", "http, https")).toBe("http://example.org");
  });
});

describe("sitemapEntries", () => {
  const jobs = [
    job("j1", "e1"),
    job("j2", "e1", { expiresAt: "2026-10-15T00:00:00.000Z" }),
    job("j3", "e2", { status: "removed" }),
    job("j4", "e3", { status: "pending_review" }),
    job("j5", "e4"),
  ];
  const urls = sitemapEntries(
    "https://zhaogong.nz",
    jobs,
    [employer("e1"), employer("e2"), employer("e3"), employer("e4", { bannedAt: "2026-10-14T00:00:00.000Z" })],
    now,
  ).map((e) => e.url);

  it("lists the home page, the job list and only open jobs", () => {
    expect(urls).toContain("https://zhaogong.nz/");
    expect(urls).toContain("https://zhaogong.nz/jobs");
    expect(urls).toContain("https://zhaogong.nz/jobs/j1");
    for (const id of ["j2", "j3", "j4"]) expect(urls).not.toContain(`https://zhaogong.nz/jobs/${id}`);
  });

  it("lists the internship and professional sections, but no external job's own page (#264)", () => {
    expect(urls).toContain("https://zhaogong.nz/internships");
    expect(urls).toContain("https://zhaogong.nz/professional");
    expect(urls.some((url) => url.includes("/external/"))).toBe(false);
  });

  it("lists the businesses that are hiring and not banned", () => {
    expect(urls).toContain("https://zhaogong.nz/employers/e1");
    for (const id of ["e2", "e3", "e4"]) expect(urls).not.toContain(`https://zhaogong.nz/employers/${id}`);
  });
});

describe("robotsRules", () => {
  it("keeps personal pages and tools out, and points at the sitemap", () => {
    const robots = robotsRules("https://zhaogong.nz");
    expect(robots.sitemap).toBe("https://zhaogong.nz/sitemap.xml");
    expect(robots.rules).toMatchObject({ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS });
    for (const path of ["/admin", "/me", "/messages", "/profile", "/candidates/", "/resume/"])
      expect(PRIVATE_PATHS).toContain(path);
    expect(PRIVATE_PATHS).not.toContain("/employer");
  });
});
