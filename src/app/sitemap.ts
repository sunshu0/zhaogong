import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { DEFAULT_COUNTRY } from "@/config/countries";
import { listAllJobs, listEmployers } from "@/lib/data";
import { siteOrigin, sitemapEntries } from "@/lib/site";

/** sitemap.xml: open jobs and the businesses hiring (R-32), read per request so closed jobs leave it at once. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const request = await headers();
  const origin = siteOrigin(process.env.SITE_URL, request.get("host"), request.get("x-forwarded-proto"));
  const [jobs, employers] = await Promise.all([listAllJobs(DEFAULT_COUNTRY), listEmployers()]);
  return sitemapEntries(origin, jobs, employers, Date.now());
}
