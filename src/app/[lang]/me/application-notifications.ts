// 已录用和职位结束 (#105) for the job seeker: when each job they applied for ended, and the notifications that follow
// (录用了你; 已经招满 / 已结束). Worked out when read, from the job and the application, so nothing is stored or sent
// when a job ends (ADR 0019). Not a Server Function: it takes the email, so only server code that read the email
// from the session calls it (messages/server-notifications.ts, jobs/[id]/apply-actions.ts). Server only.
import { getEmployer, getJob, listModerationLog } from "@/lib/data";
import { myApplications, type ApplicationRow } from "@/db/job-applications";
import { postedAgo } from "@/components/seeker/format";
import { hiredNotificationId, jobEndedAt, jobEndedNotificationId } from "@/components/seeker/applications";
import type { Notification } from "@/components/seeker/hub-state";
import type { Job } from "@/lib/types";
import type { Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";
import { requestLang } from "@/i18n/server";

/**
 * When each job stopped taking people, or null while open (jobEndedAt). For a job taken down, the time comes from
 * the moderation log (its take-down, or its business's ban), read only when one of the jobs was taken down.
 */
export async function jobEndings(jobs: readonly Job[], now: number): Promise<Map<string, string | null>> {
  const takenDown = new Map<string, string>();
  if (jobs.some((job) => job.status === "removed")) {
    // Newest first: keep each job's and each business's latest.
    for (const entry of await listModerationLog()) {
      if (entry.action === "take_down" && entry.jobId && !takenDown.has(entry.jobId))
        takenDown.set(entry.jobId, entry.at);
      if (entry.action === "ban" && entry.employerId && !takenDown.has(`employer:${entry.employerId}`))
        takenDown.set(`employer:${entry.employerId}`, entry.at);
    }
  }
  return new Map(
    jobs.map((job) => [
      job.id,
      jobEndedAt(job, now, takenDown.get(job.id) ?? takenDown.get(`employer:${job.employerId}`)),
    ]),
  );
}

/**
 * The job seeker's notifications about how their applications ended: the business hired them, or the job has ended
 * (招满 when the employer said they hired someone). The same words for everyone not hired, 不合适 included, so the
 * employer's 不合适 never shows.
 */
export async function applicationOutcomeNotifications(email: string, now: number): Promise<Notification[]> {
  const rows = await myApplications(email);
  const jobs = new Map<string, Job>();
  for (const row of rows) {
    const job = await getJob(row.jobId);
    if (job) jobs.set(job.id, job);
  }
  const endings = await jobEndings([...jobs.values()], now);
  // Made per request in the visitor's language (Round 20).
  const lang = await requestLang();
  const notes = await Promise.all(
    rows.map(async (row): Promise<Notification | null> => {
      const job = jobs.get(row.jobId);
      if (!job) return null;
      const business = (await getEmployer(job.employerId))?.name ?? "";
      return outcome(row, job, endings.get(job.id) ?? null, business, now, lang);
    }),
  );
  return notes.filter((n): n is Notification => n !== null);
}

function outcome(
  row: ApplicationRow,
  job: Job,
  endedAt: string | null,
  business: string,
  now: number,
  lang: Lang,
): Notification | null {
  const t = pick(seekerMeMessages, lang).notices;
  if (row.decision === "hired")
    return {
      id: hiredNotificationId(row.id),
      type: "申请",
      title: t.hired(business),
      detail: t.hiredDetail(job.titleZh),
      time: postedAgo(row.decidedAt ?? row.appliedAt, now, lang),
      unread: true,
      target: { type: "applications" },
    };
  if (!endedAt) return null;
  return {
    id: jobEndedNotificationId(row.id),
    type: "申请",
    title: job.hiresConfirmed ? t.filled(job.titleZh) : t.ended(job.titleZh),
    detail: t.endedDetail(business),
    time: postedAgo(endedAt, now, lang),
    unread: true,
    target: { type: "applications" },
  };
}
