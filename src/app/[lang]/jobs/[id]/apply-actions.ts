"use server";

// 一键申请, the job seeker's side (#84, PRD R-35). The account is the one in this browser's session cookie. The page
// the employer gets is the account's own (#104); the page the browser sends is used only when the account never
// saved one.
import { regionById } from "@/config/countries";
import { getCurrentSession } from "@/lib/auth";
import { getEmployer, getJob } from "@/lib/data";
import type { CountryCode, PayRange } from "@/lib/types";
import { addApplication, myApplication, myApplications, withdrawApplication } from "@/db/job-applications";
import {
  applyError,
  applicationStage,
  parseApplicationNote,
  parseApplicationProfile,
  seekerStatus,
  type ApplicationDecision,
  type ApplyRefusal,
} from "@/components/seeker/applications";
import { isExpired } from "@/components/seeker/job-facts";
import { interviewsFor, interviewView } from "@/db/interviews";
import { getSeekerProfile } from "@/db/seeker-profiles";
import { initialProfile } from "@/components/seeker/hub-state";
import type { InterviewView } from "@/components/seeker/interviews";
import { jobEndings } from "@/app/[lang]/me/application-notifications";
import { placeName } from "@/components/seeker/format";
import type { Lang } from "@/i18n/lang";
import { requestLang } from "@/i18n/server";

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
  /** 进行中, or 已结束 once the person is hired or the job has ended (#105). */
  stage: "open" | "ended";
  /** The employer's interview invitation, if any (#103). */
  interview: InterviewView | null;
};

export type ApplyResult = { ok: true; application: MyApplication } | { ok: false; reason: ApplyRefusal; error: string };

const refuse = async (reason: ApplyRefusal): Promise<ApplyResult> => ({
  ok: false,
  reason,
  error: applyError(reason, await requestLang()),
});

function view(
  row: {
    jobId: string;
    appliedAt: string;
    note: string;
    seenAt: string | null;
    decision: ApplicationDecision | null;
  },
  ended = false,
  lang: Lang = "zh",
): MyApplication {
  return { jobId: row.jobId, appliedAt: row.appliedAt, note: row.note, status: seekerStatus(row, ended, lang) };
}

/** The account's application for the job, or null (none, or signed out). */
export async function myJobApplication(jobId: string): Promise<MyApplication | null> {
  const session = await getCurrentSession();
  if (!session || typeof jobId !== "string") return null;
  const row = await myApplication(session.email, jobId);
  if (!row) return null;
  const job = await getJob(row.jobId);
  const ended = job ? (await jobEndings([job], Date.now())).get(job.id) != null : false;
  return view(row, ended, await requestLang());
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
  if (!session) return await refuse("signed_out");
  if (session.activeRole === "employer") return await refuse("employer_identity");
  const job = typeof jobId === "string" ? await getJob(jobId) : undefined;
  const employer = job && (await getEmployer(job.employerId));
  // A ban also takes the business's jobs down; say why.
  if (employer?.bannedAt) return await refuse("banned");
  if (!job || !employer || job.status !== "active" || isExpired(job, Date.now())) return await refuse("closed");
  if (session.employer?.id === employer.id) return await refuse("own_job");
  const parsedNote = parseApplicationNote(note, await requestLang());
  if (!parsedNote.ok) return await refuse("note_too_long");
  const own = await getSeekerProfile(session.email);
  const seeker = { email: session.email, signedInAt: "", activeRole: "seeker" as const };
  const page = parseApplicationProfile(own ? { ...initialProfile(seeker), ...own.profile } : profile);
  if (!page) return await refuse("no_profile");

  const row = await addApplication({
    email: session.email,
    jobId: job.id,
    employerId: employer.id,
    note: parsedNote.note,
    profile: page,
  });
  if (row === "already") return await refuse("already");
  return { ok: true, application: view(row, false, await requestLang()) };
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
  const lang = await requestLang();
  const now = Date.now();
  const rows = await myApplications(session.email);
  const interviews = await interviewsFor(rows.map((row) => row.id));
  const jobs = new Map(
    (await Promise.all(rows.map((row) => getJob(row.jobId)))).flatMap((j) => (j ? [[j.id, j]] : [])),
  );
  const endings = await jobEndings([...jobs.values()], now);
  const views = await Promise.all(
    rows.map(async (row): Promise<MyApplicationView | null> => {
      const job = jobs.get(row.jobId);
      if (!job) return null;
      const employer = await getEmployer(job.employerId);
      const ended = endings.get(job.id) != null;
      return {
        ...view(row, ended, lang),
        stage: applicationStage(row.decision, ended),
        titleZh: job.titleZh,
        titleEn: job.titleEn,
        pay: job.pay,
        country: job.country,
        region: placeName(regionById(job.country, job.regionId), lang),
        employerName: employer?.name,
        gone: job.status !== "active" || isExpired(job, now) || !!employer?.bannedAt,
        interview: interviews.has(row.id) ? interviewView(interviews.get(row.id)!) : null,
      };
    }),
  );
  return views.filter((v): v is MyApplicationView => v !== null);
}
