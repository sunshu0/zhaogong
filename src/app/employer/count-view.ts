"use server";

// Counts a job page view for the employer's numbers (#55). Called once per page load by the job page
// (RecordView). The browser is known only by a random id in an httpOnly cookie, stored hashed: no IP, no account
// (src/lib/visitor.ts). The job page hands the id out (src/proxy.ts, #79). This never sets the cookie: a Server
// Function answer that sets one makes Next refresh the page, which rewrites the address without a #contact the
// page's own link added (#90). A browser that arrives without the id (cookies refused) counts under a throw-away
// one, as it would if the cookie were set and then not kept.
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { recordJobView } from "@/db/job-stats";
import { getCurrentSession } from "@/lib/auth";
import { getJob } from "@/lib/data";
import { VISITOR_COOKIE, isVisitorId, newVisitorId } from "@/lib/visitor";

export async function countJobView(jobId: string): Promise<void> {
  if (typeof jobId !== "string") return;
  const job = await getJob(jobId);
  if (!job || (job.status !== "active" && job.status !== "expired")) return;
  // The business looking at its own job is not a view.
  if ((await getCurrentSession())?.employer?.id === job.employerId) return;

  const sent = (await cookies()).get(VISITOR_COOKIE)?.value;
  const visitor = isVisitorId(sent) ? sent : newVisitorId();
  await recordJobView(job.id, createHash("sha256").update(visitor).digest("hex"));
}
