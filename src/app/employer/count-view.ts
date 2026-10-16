"use server";

// Counts a job page view for the employer's numbers (#55). Called once per page load by the job page
// (RecordView). The browser is known only by a random id in an httpOnly cookie, stored hashed: no IP, no account
// (src/lib/visitor.ts). The job page hands the id out (src/proxy.ts, #79); this sets one only if it is missing.
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { recordJobView } from "@/db/job-stats";
import { getCurrentSession } from "@/lib/auth";
import { isProduction } from "@/lib/auth/config";
import { getJob } from "@/lib/data";
import { VISITOR_COOKIE, isVisitorId, newVisitorId, visitorCookieOptions } from "@/lib/visitor";

export async function countJobView(jobId: string): Promise<void> {
  if (typeof jobId !== "string") return;
  const job = await getJob(jobId);
  if (!job || (job.status !== "active" && job.status !== "expired")) return;
  // The business looking at its own job is not a view.
  if ((await getCurrentSession())?.employer?.id === job.employerId) return;

  const jar = await cookies();
  let visitor = jar.get(VISITOR_COOKIE)?.value;
  if (!isVisitorId(visitor)) {
    visitor = newVisitorId();
    jar.set(VISITOR_COOKIE, visitor, visitorCookieOptions(isProduction()));
  }
  await recordJobView(job.id, createHash("sha256").update(visitor).digest("hex"));
}
