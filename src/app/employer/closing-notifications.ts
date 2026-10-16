// The employer identity's notifications about its jobs closing soon (#69). Not a Server Function: it takes the email,
// so only server code that read the email from the session calls it (me/alerts/actions.ts). Server only.
import { getAccountEmployer, listJobsByEmployer } from "@/lib/data";
import { closingReminders } from "@/components/employer/job-reminders";
import { postedAgoZh } from "@/components/seeker/format";
import type { Notification } from "@/components/seeker/hub-state";

export async function myClosingNotifications(email: string, now: number): Promise<Notification[]> {
  const employer = await getAccountEmployer(email);
  if (!employer) return [];
  return closingReminders(await listJobsByEmployer(employer.id), now).map((reminder) => ({
    id: reminder.id,
    type: "招聘",
    title: reminder.title,
    detail: reminder.detail,
    time: postedAgoZh(reminder.since, now),
    unread: true,
    target: { type: "closing_jobs" },
  }));
}
