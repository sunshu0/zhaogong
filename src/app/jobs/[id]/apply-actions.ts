"use server";

// 一键申请, the job seeker's side (#84, PRD R-35). The account is the one in this browser's session cookie; the page
// sends only the job, the note and the job seeker's own page (their profile lives in their browser).
import { regionById } from "@/config/countries";
import { getCurrentSession } from "@/lib/auth";
import { getEmployer, getJob } from "@/lib/data";
import type { CountryCode, PayRange } from "@/lib/types";
import { addApplication, myApplication, myApplications, withdrawApplication } from "@/db/job-applications";
import {
  APPLY_ERRORS,
  parseApplicationNote,
  parseApplicationProfile,
  seekerStatus,
  type ApplyRefusal,
} from "@/components/seeker/applications";
import { isExpired } from "@/components/seeker/job-facts";

/** The account's application for one job, as the job seeker sees it. */
export type MyApplication = { jobId: string; appliedAt: string; note: string; status: string };

/** One of the account's applications, with the job, for 收藏和进度. */
export type MyApplicationView = MyApplication & {
  titleZh: string;
  titleEn: string;
  pay: PayRange;
  country: CountryCode;
  region?: string;
  employerName?: string;
  /** Taken down or past its closing date. */
  gone: boolean;
};

export type ApplyResult = { ok: true; application: MyApplication } | { ok: false; reason: ApplyRefusal; error: string };

const refuse = (reason: ApplyRefusal): ApplyResult => ({ ok: false, reason, error: APPLY_ERRORS[reason] });

function view(row: {
  jobId: string;
  appliedAt: string;
  note: string;
  seenAt: string | null;
  decision: "fit" | "unfit" | null;
}): MyApplication {
  return { jobId: row.jobId, appliedAt: row.appliedAt, note: row.note, status: seekerStatus(row) };
}

/** The account's application for the job, or null (none, or signed out). */
export async function myJobApplication(jobId: string): Promise<MyApplication | null> {
  const session = await getCurrentSession();
  if (!session || typeof jobId !== "string") return null;
  const row = await myApplication(session.email, jobId);
  return row ? view(row) : null;
}

/** Ids of the jobs the account applied for, for the job rows; null when signed out. */
export async function myAppliedJobIds(): Promise<string[] | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  return (await myApplications(session.email)).map((row) => row.jobId);
}

/**
 * Applies for a job as the job seeker identity. Refused for a job that is closed or taken down, a banned business,
 * the account's own business, a second application, or a page without a name.
 */
export async function applyForJob(jobId: string, note: unknown, profile: unknown): Promise<ApplyResult> {
  const session = await getCurrentSession();
  if (!session) return refuse("signed_out");
  if (session.activeRole === "employer") return refuse("employer_identity");
  const job = typeof jobId === "string" ? await getJob(jobId) : undefined;
  const employer = job && (await getEmployer(job.employerId));
  // A ban also takes the business's jobs down; say why.
  if (employer?.bannedAt) return refuse("banned");
  if (!job || !employer || job.status !== "active" || isExpired(job, Date.now())) return refuse("closed");
  if (session.employer?.id === employer.id) return refuse("own_job");
  const parsedNote = parseApplicationNote(note);
  if (!parsedNote.ok) return refuse("note_too_long");
  const page = parseApplicationProfile(profile);
  if (!page) return refuse("no_profile");

  const row = await addApplication({
    email: session.email,
    jobId: job.id,
    employerId: employer.id,
    note: parsedNote.note,
    profile: page,
  });
  if (row === "already") return refuse("already");
  return { ok: true, application: view(row) };
}

/** Withdraws the account's application; the employer no longer sees it. */
export async function withdrawMyApplication(jobId: string): Promise<boolean> {
  const session = await getCurrentSession();
  if (!session || typeof jobId !== "string") return false;
  await withdrawApplication(session.email, jobId);
  return true;
}

/** The account's applications with their jobs, newest first; null when signed out. */
export async function myApplicationViews(): Promise<MyApplicationView[] | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  const now = Date.now();
  const views = await Promise.all(
    (await myApplications(session.email)).map(async (row): Promise<MyApplicationView | null> => {
      const job = await getJob(row.jobId);
      if (!job) return null;
      const employer = await getEmployer(job.employerId);
      return {
        ...view(row),
        titleZh: job.titleZh,
        titleEn: job.titleEn,
        pay: job.pay,
        country: job.country,
        region: regionById(job.country, job.regionId)?.nameZh,
        employerName: employer?.name,
        gone: job.status !== "active" || isExpired(job, now) || !!employer?.bannedAt,
      };
    }),
  );
  return views.filter((v): v is MyApplicationView => v !== null);
}
