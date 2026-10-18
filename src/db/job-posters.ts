// 职位记下是谁发的 (#182): who posted each of a business's jobs, as its team sees it. The email stays on the server and
// in the team; a job's public page never has it. Server only.
import { and, eq, isNotNull } from "drizzle-orm";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { normalizeEmail } from "@/components/seeker/session";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";
import type { JobPoster } from "@/components/employer/job-poster";

/** The business's jobs that know who posted them, said for `viewer`, and how many people the team has now. */
export async function listJobPosters(
  employerId: string,
  viewer: string,
): Promise<{ teamSize: number; posters: Record<string, JobPoster> }> {
  const me = normalizeEmail(viewer);
  const db = await database();
  const team = await db
    .select({ email: t.accounts.email, name: t.accounts.teamName })
    .from(t.accounts)
    .where(eq(t.accounts.employerId, employerId));
  const rows = await db
    .select({ id: t.jobs.id, postedBy: t.jobs.postedBy })
    .from(t.jobs)
    .where(and(eq(t.jobs.employerId, employerId), isNotNull(t.jobs.postedBy)));
  const posters: Record<string, JobPoster> = {};
  for (const { id, postedBy } of rows) {
    if (!postedBy) continue;
    const teammate = team.find((m) => m.email === postedBy);
    posters[id] =
      postedBy === me
        ? { kind: "you" }
        : teammate
          ? { kind: "teammate", name: teammate.name ?? teammate.email }
          : postedBy === DELETED_ACCOUNT
            ? { kind: "deleted" }
            : { kind: "left", email: postedBy };
  }
  return { teamSize: team.length, posters };
}

/** The jobs this account posted, in any business (for 导出我的数据). */
export async function listJobsPostedBy(
  email: string,
): Promise<{ jobId: string; employerId: string; postedAt: string }[]> {
  const db = await database();
  return db
    .select({ jobId: t.jobs.id, employerId: t.jobs.employerId, postedAt: t.jobs.postedAt })
    .from(t.jobs)
    .where(eq(t.jobs.postedBy, normalizeEmail(email)))
    .orderBy(t.jobs.postedAt);
}
