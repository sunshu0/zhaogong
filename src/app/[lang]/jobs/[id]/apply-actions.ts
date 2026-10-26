"use server";

// 我的申请, the job seeker's side (#84, PRD R-35): read only since the user took 申请 off the job pages (10-20
// 11:0x); chatting is how a job seeker gets in touch now, and a job they chatted about is listed too (ADR 0030), so
// its interview can be answered and its notices lead somewhere. The account is the one in this browser's session
// cookie.
import { isBanned } from "@/lib/employer-ban";
import { regionById } from "@/config/countries";
import { getCurrentSession } from "@/lib/auth";
import { getEmployer, getJob } from "@/lib/data";
import { myApplications } from "@/db/job-applications";
import { applicationStage } from "@/components/seeker/applications";
import { isExpired } from "@/components/seeker/job-facts";
import { interviewsFor, interviewView } from "@/db/interviews";
import { jobEndings } from "@/app/[lang]/me/application-notifications";
import { placeName } from "@/components/seeker/format";
import { requestLang } from "@/i18n/server";
import { view, type MyApplicationView } from "@/lib/applications-server";

export type { MyApplication, MyApplicationView } from "@/lib/applications-server";

/** Ids of the jobs the account applied for, for the job rows (not those it only chatted about); null when signed out. */
export async function myAppliedJobIds(): Promise<string[] | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  return (await myApplications(session.email)).filter((row) => row.source === "apply").map((row) => row.jobId);
}

/** The account's applications and the jobs it chatted about, with their jobs, newest first; null when signed out. */
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
        gone: job.status !== "active" || isExpired(job, now) || isBanned(employer, now),
        interview: interviews.has(row.id) ? interviewView(interviews.get(row.id)!) : null,
      };
    }),
  );
  return views.filter((v): v is MyApplicationView => v !== null);
}
