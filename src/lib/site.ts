// What search engines get: the site's address, which pages to list in sitemap.xml and which to keep out of
// robots.txt (R-32). Pure, so the route files stay thin and the rules are tested.
import type { MetadataRoute } from "next";
import { isOpenJob } from "@/lib/job-expiry";
import type { Employer, Job } from "@/lib/types";

/**
 * Pages that belong to one person or to the site's own tools: not for search engines. /employer (the page about
 * posting) stays open; what is under it is the employer's own tools. /candidates/ are job seekers' pages.
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

/** The home page, the job list, every open job, and the page of each business that has one. */
export function sitemapEntries(origin: string, jobs: Job[], employers: Employer[], now: number): MetadataRoute.Sitemap {
  const open = jobs.filter((job) => isOpenJob(job, now));
  const hiring = new Set(open.map((job) => job.employerId));
  return [
    { url: `${origin}/`, changeFrequency: "daily", priority: 1 },
    { url: `${origin}/jobs`, changeFrequency: "hourly", priority: 0.9 },
    ...open.map((job) => ({
      url: `${origin}/jobs/${job.id}`,
      lastModified: job.postedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...employers
      .filter((employer) => !employer.bannedAt && hiring.has(employer.id))
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
