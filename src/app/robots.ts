import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import { robotsRules, siteOrigin } from "@/lib/site";

/** robots.txt: personal pages and tools stay out of search engines (R-32). */
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection();
  const request = await headers();
  return robotsRules(siteOrigin(process.env.SITE_URL, request.get("host"), request.get("x-forwarded-proto")));
}
