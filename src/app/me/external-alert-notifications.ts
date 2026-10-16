// External jobs the job seeker's alerts on 实习 and 专业职位 found (#131), in the notification list. Not a Server
// Function: it takes the email, so only server code that read the email from the session calls it
// (messages/server-notifications.ts). Server only.
import { listExternalJobAlertHits } from "@/db/external-job-alerts";
import { getExternalJob } from "@/db/external-jobs";
import { postedAgoZh } from "@/components/seeker/format";
import { externalAlertNotificationId } from "@/lib/external-jobs/alerts";
import { isShown } from "@/lib/external-jobs/visibility";
import type { Notification } from "@/components/seeker/hub-state";

export async function externalAlertNotifications(email: string, now: number): Promise<Notification[]> {
  return Promise.all(
    (await listExternalJobAlertHits(email)).map(async (hit): Promise<Notification> => {
      const job = await getExternalJob(hit.externalJobId);
      return {
        id: externalAlertNotificationId(hit.externalJobId),
        type: "提醒",
        title: `有外部职位符合提醒「${hit.alertName}」`,
        detail:
          job && isShown(job, now)
            ? `${job.companyName}：${job.title}（来自公司官网）`
            : `${job?.title ?? "这个职位"}已经下架`,
        time: postedAgoZh(hit.createdAt, now),
        unread: true,
        target: { type: "external_job", id: hit.externalJobId },
      };
    }),
  );
}
