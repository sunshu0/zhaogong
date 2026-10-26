// What search engines get: the site's address, which pages to list in sitemap.xml and which to keep out of
// robots.txt (R-32). Pure, so the route files stay thin and the rules are tested.
import { isBanned } from "@/lib/employer-ban";
import type { MetadataRoute } from "next";
import { isOpenJob } from "@/lib/job-expiry";
import type { Employer, Job } from "@/lib/types";

/**
 * Pages that belong to one person or to the site's own tools: not for search engines. /employer (the page about
 * posting) stays open; what is under it is the employer's own tools. /candidates/ are job seekers' pages, and
 * /resume/ the resumes they share by link (#86).
 */
export const PRIVATE_PATHS = [
  "/admin",
  "/account",
  "/workspace",
  "/profile",
  "/me",
  "/messages",
  "/notifications",
  "/login",
  "/employer/",
  "/candidates/",
  "/resume/",
  "/api/",
];

/**
 * The site's address for absolute links: SITE_URL when set (for a custom domain), otherwise the host the request
 * came to — http for localhost, otherwise the forwarded protocol or https.
 */
export function siteOrigin(siteUrl: string | undefined, host: string | null, forwardedProto: string | null): string {
  if (siteUrl) return siteUrl.replace(/\/+$/, "");
  const name = host ?? "localhost";
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(name);
  const proto = forwardedProto?.split(",")[0].trim() || (local ? "http" : "https");
  return `${proto}://${name}`;
}

/**
 * The home page, the job list, the internship and professional sections (#264), every open job, and the page of each
 * business that has one. An external job's own page stays out: it is noindex (ADR 0014, 10).
 */
export function sitemapEntries(origin: string, jobs: Job[], employers: Employer[], now: number): MetadataRoute.Sitemap {
  // A temporarily banned business's jobs stay active but are not shown (ADR 0044).
  const banned = new Set(employers.filter((e) => isBanned(e, now)).map((e) => e.id));
  const open = jobs.filter((job) => isOpenJob(job, now) && !banned.has(job.employerId));
  const hiring = new Set(open.map((job) => job.employerId));
  return [
    { url: `${origin}/`, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/jobs`, changeFrequency: "hourly", priority: 0.9 },
    // The external jobs in them are imported once a day.
    { url: `${origin}/internships`, changeFrequency: "daily", priority: 0.7 },
    { url: `${origin}/professional`, changeFrequency: "daily", priority: 0.7 },
    // 关于找工 (#324), and the privacy statement and terms of use (#323).
    { url: `${origin}/about`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${origin}/privacy`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${origin}/terms`, changeFrequency: "monthly", priority: 0.3 },
    ...open.map((job) => ({
      url: `${origin}/jobs/${job.id}`,
      lastModified: job.postedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...employers
      .filter((employer) => !banned.has(employer.id) && hiring.has(employer.id))
      .map((employer) => ({
        url: `${origin}/employers/${employer.id}`,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      })),
  ];
}

export function robotsRules(origin: string): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }, sitemap: `${origin}/sitemap.xml` };
}
