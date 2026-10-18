// 将截止 reminders (#69, PRD R-33). From 3 days before a live job's closing date, and after it ran out for as long
// as it can still be renewed, the employer's workspace lists the job and 通知 has one notification about it. Worked
// out when read, like the closing itself (ADR 0008): nothing runs on a timer.
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerJobsMessages } from "@/i18n/messages/employer-jobs";
import type { Job } from "@/lib/types";
import { ENDING_DAYS, jobPhase, renewDaysLeft, untilCloseZh } from "@/components/employer/job-status";

const DAY_MS = 86_400_000;

export type ClosingReminder = {
  /**
   * One per job and closing date, so a notification read stays read until the job closes, and a renewed job is
   * reminded again before its new date.
   */
  id: string;
  jobId: string;
  title: string;
  detail: string;
  /** When the reminder began: 3 days before the closing date, or the closing date once it has passed. */
  since: string;
};

type ReminderJob = Pick<Job, "id" | "titleZh" | "status" | "expiresAt">;

/** The employer's jobs that close soon or ran out and can still be renewed, soonest closing first. */
export function closingReminders(
  jobs: readonly ReminderJob[],
  now: number,
  lang: Lang = DEFAULT_LANG,
): ClosingReminder[] {
  const t = pick(employerJobsMessages, lang).reminders;
  const reminders: ClosingReminder[] = [];
  for (const job of [...jobs].sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt))) {
    const phase = jobPhase(job, now);
    const id = `closing:${job.id}:${job.expiresAt}`;
    const closes = Date.parse(job.expiresAt);
    if (phase === "ending") {
      reminders.push({
        id,
        jobId: job.id,
        title: t.endingTitle(job.titleZh, untilCloseZh(job, now, lang)),
        detail: t.endingDetail,
        since: new Date(closes - ENDING_DAYS * DAY_MS).toISOString(),
      });
    } else if (phase === "timed_out" && renewDaysLeft(job, now) > 0) {
      // Ran out by itself; a job the employer ended on purpose needs no reminder.
      reminders.push({
        id,
        jobId: job.id,
        title: t.timedOutTitle(job.titleZh),
        detail: t.timedOutDetail(renewDaysLeft(job, now)),
        since: job.expiresAt,
      });
    }
  }
  return reminders;
}
