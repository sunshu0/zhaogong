// The employer identity's notifications about its jobs closing soon (#69). Not a Server Function: it takes the email,
// so only server code that read the email from the session calls it (messages/server-notifications.ts). Server only.
import { getAccountEmployer, listJobsByEmployer } from "@/lib/data";
import { closingReminders } from "@/components/employer/job-reminders";
import { postedAgoZh } from "@/components/seeker/format";
import type { Notification } from "@/components/seeker/hub-state";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerJobsMessages } from "@/i18n/messages/employer-jobs";

export async function myClosingNotifications(
  email: string,
  now: number,
  lang: Lang = DEFAULT_LANG,
): Promise<Notification[]> {
  const employer = await getAccountEmployer(email);
  if (!employer) return [];
  const type = pick(employerJobsMessages, lang).reminders.type;
  return closingReminders(await listJobsByEmployer(employer.id), now, lang).map((reminder) => ({
    id: reminder.id,
    type,
    title: reminder.title,
    detail: reminder.detail,
    time: postedAgoZh(reminder.since, now),
    unread: true,
    target: { type: "closing_jobs" },
  }));
}
