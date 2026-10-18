// The employer identity's notifications about applications (#84). Not a Server Function: it takes the email, so only
// server code that read the email from the session calls it (messages/server-notifications.ts). Server only.
import { getAccountEmployer, getJob } from "@/lib/data";
import { applicationsOfBusiness } from "@/db/job-applications";
import { postedAgoZh } from "@/components/seeker/format";
import { applicationNotificationId } from "@/components/seeker/applications";
import type { Notification } from "@/components/seeker/hub-state";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerApplicantsMessages } from "@/i18n/messages/employer-applicants";

/** The business's latest applications, newest first; one it has already looked at counts as read. */
export async function myApplicationNotifications(
  email: string,
  now: number,
  lang: Lang = DEFAULT_LANG,
): Promise<Notification[]> {
  const t = pick(employerApplicantsMessages, lang).notifications;
  const employer = await getAccountEmployer(email);
  if (!employer) return [];
  const rows = await applicationsOfBusiness(employer.id);
  return Promise.all(
    rows.map(async (row): Promise<Notification> => {
      const job = await getJob(row.jobId);
      return {
        id: applicationNotificationId(row.id),
        type: t.type,
        title: t.applied(row.profile.name, job?.titleZh ?? t.yourJob),
        detail: row.note ? t.note(row.note) : t.noNote,
        time: postedAgoZh(row.appliedAt, now),
        unread: !row.seenAt,
        target: { type: "applicants", jobId: row.jobId },
      };
    }),
  );
}
