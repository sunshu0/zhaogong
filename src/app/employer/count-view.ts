"use server";

// Counts a job page view for the employer's numbers (#55). Called once per page load by the job page
// (RecordView). The browser is known only by a random id in an httpOnly cookie, stored hashed: no IP, no account.
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { recordJobView } from "@/db/job-stats";
import { getCurrentSession } from "@/lib/auth";
import { isProduction } from "@/lib/auth/config";
import { getJob } from "@/lib/data";

const VISITOR_COOKIE = "zg_visitor";
const YEAR_SECONDS = 365 * 24 * 3600;

export async function countJobView(jobId: string): Promise<void> {
  if (typeof jobId !== "string") return;
  const job = await getJob(jobId);
  if (!job || (job.status !== "active" && job.status !== "expired")) return;
  // The business looking at its own job is not a view.
  if ((await getCurrentSession())?.employer?.id === job.employerId) return;

  const jar = await cookies();
  let visitor = jar.get(VISITOR_COOKIE)?.value;
  if (!visitor || !/^[A-Za-z0-9_-]{22}$/.test(visitor)) {
    visitor = randomBytes(16).toString("base64url");
    jar.set(VISITOR_COOKIE, visitor, {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction(),
      path: "/",
      maxAge: YEAR_SECONDS,
    });
  }
  await recordJobView(job.id, createHash("sha256").update(visitor).digest("hex"));
}
