// 职位记下是谁发的 (#182) and who filled its contact details (#186): as a business's team sees it. The emails stay on
// the server and in the team; a job's public page never has them. Server only.
import { and, eq, isNotNull, or } from "drizzle-orm";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { normalizeEmail } from "@/components/seeker/session";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";
import type { JobPoster } from "@/components/employer/job-poster";

export type JobPosters = {
  /** How many people the team has now. */
  teamSize: number;
  /** Who posted each job, said for the viewer; jobs from before #182 are left out. */
  posters: Record<string, JobPoster>;
  /**
   * Jobs that show contact details filled by someone no longer in the team (#186): the team should check them,
   * since job seekers would reach that person. Only `left` and `deleted` appear here.
   */
  contactsFrom: Record<string, Extract<JobPoster, { kind: "left" | "deleted" }>>;
};

const hasContact = (contact: { phone?: string; wechat?: string; email?: string }) =>
  Object.values(contact).some((value) => typeof value === "string" && value.trim() !== "");

/** The business's jobs that know who posted them or filled their contact, said for `viewer`. */
export async function listJobPosters(employerId: string, viewer: string): Promise<JobPosters> {
  const me = normalizeEmail(viewer);
  const db = await database();
  const team = await db
    .select({ email: t.accounts.email, name: t.accounts.teamName })
    .from(t.accounts)
    .where(eq(t.accounts.employerId, employerId));
  const rows = await db
    .select({
      id: t.jobs.id,
      postedBy: t.jobs.postedBy,
      contactBy: t.jobs.contactBy,
      contactPublic: t.jobs.contactPublic,
      contact: t.jobs.contact,
    })
    .from(t.jobs)
    .where(and(eq(t.jobs.employerId, employerId), or(isNotNull(t.jobs.postedBy), isNotNull(t.jobs.contactBy))));
  const who = (email: string): JobPoster => {
    if (email === me) return { kind: "you" };
    const teammate = team.find((m) => m.email === email);
    if (teammate) return { kind: "teammate", name: teammate.name ?? teammate.email };
    return email === DELETED_ACCOUNT ? { kind: "deleted" } : { kind: "left", email };
  };
  const posters: JobPosters["posters"] = {};
  const contactsFrom: JobPosters["contactsFrom"] = {};
  for (const row of rows) {
    if (row.postedBy) posters[row.id] = who(row.postedBy);
    const filledBy = row.contactBy ?? row.postedBy;
    if (!filledBy || !row.contactPublic || !hasContact(row.contact)) continue;
    const filler = who(filledBy);
    if (filler.kind === "left" || filler.kind === "deleted") contactsFrom[row.id] = filler;
  }
  return { teamSize: team.length, posters, contactsFrom };
}

/** After `email` changed a job's contact details (#186): they are that person's now. */
export async function recordContactBy(jobId: string, email: string): Promise<void> {
  const db = await database();
  await db
    .update(t.jobs)
    .set({ contactBy: normalizeEmail(email) })
    .where(eq(t.jobs.id, jobId));
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

/** The jobs whose contact details this account changed last (#186), in any business (for 导出我的数据). */
export async function listJobContactsBy(email: string): Promise<{ jobId: string; employerId: string }[]> {
  const db = await database();
  return db
    .select({ jobId: t.jobs.id, employerId: t.jobs.employerId })
    .from(t.jobs)
    .where(eq(t.jobs.contactBy, normalizeEmail(email)))
    .orderBy(t.jobs.id);
}
