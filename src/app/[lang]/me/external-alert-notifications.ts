// External jobs the job seeker's alerts on 实习 and 专业职位 found (#131), in the notification list. Not a Server
// Function: it takes the email, so only server code that read the email from the session calls it
// (messages/server-notifications.ts). Server only.
import { listExternalJobAlertHits } from "@/db/external-job-alerts";
import { getExternalJob } from "@/db/external-jobs";
import { postedAgo } from "@/components/seeker/format";
import { externalAlertNotificationId } from "@/lib/external-jobs/alerts";
import { isShown } from "@/lib/external-jobs/visibility";
import type { Notification } from "@/components/seeker/hub-state";
import { pick } from "@/i18n/messages";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";
import { requestLang } from "@/i18n/server";

export async function externalAlertNotifications(email: string, now: number): Promise<Notification[]> {
  const lang = await requestLang();
  const t = pick(seekerMeMessages, lang).notices;
  return Promise.all(
    (await listExternalJobAlertHits(email)).map(async (hit): Promise<Notification> => {
      const job = await getExternalJob(hit.externalJobId);
      return {
        id: externalAlertNotificationId(hit.externalJobId),
        type: "提醒",
        title: t.externalAlert(hit.alertName),
        detail:
          job && isShown(job, now)
            ? t.externalJob(job.companyName, job.title)
            : t.externalGone(job?.title ?? t.thisJob),
        time: postedAgo(hit.createdAt, now, lang),
        unread: true,
        target: { type: "external_job", id: hit.externalJobId },
      };
    }),
  );
}
