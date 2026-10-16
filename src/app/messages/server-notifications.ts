// Every notification the server makes for an identity, in one place (#94): the job seeker's are the jobs its alerts
// found (#53) and team invitations (#87); the employer's are applications (#84), its jobs closing soon (#69) and 企业验证
// decisions (#78). The notification list
// (myAlertNotifications) and the ids that may be marked read (markMyNotificationsRead) both come from here, so a new
// kind of notification cannot be shown without also being markable as read. Not a Server Function: it takes the
// email, so only server code that read the email from the session calls it. Server only.
import { getEmployer, getJob } from "@/lib/data";
import { isOpenJob } from "@/lib/job-expiry";
import { listJobAlertHits } from "@/db/job-alerts";
import { myApplicationNotifications } from "@/app/employer/application-notifications";
import { myClosingNotifications } from "@/app/employer/closing-notifications";
import { myVerificationNotifications } from "@/app/employer/verification-notifications";
import { myTeamInviteNotifications } from "@/app/employer/team-notifications";
import { postedAgoZh } from "@/components/seeker/format";
import { alertNotificationId } from "@/components/seeker/job-alerts";
import type { Notification } from "@/components/seeker/hub-state";

export async function serverNotifications(
  identity: { email: string; isEmployer: boolean },
  now: number,
): Promise<Notification[]> {
  if (identity.isEmployer)
    return [
      ...(await myApplicationNotifications(identity.email, now)),
      ...(await myClosingNotifications(identity.email, now)),
      ...(await myVerificationNotifications(identity.email, now)),
    ];
  const alerts = await Promise.all(
    (await listJobAlertHits(identity.email)).map(async (hit): Promise<Notification> => {
      const job = await getJob(hit.jobId);
      const employer = job && (await getEmployer(job.employerId));
      return {
        id: alertNotificationId(hit.jobId),
        type: "提醒",
        title: `有新职位符合提醒「${hit.alertName}」`,
        detail:
          job && isOpenJob(job, now)
            ? `${employer?.name ?? ""}正在招聘${job.titleZh}`
            : `${job?.titleZh ?? "这个职位"}已经停止招聘`,
        time: postedAgoZh(hit.createdAt, now),
        unread: true,
        target: { type: "job", id: hit.jobId },
      };
    }),
  );
  return [...(await myTeamInviteNotifications(identity.email, now)), ...alerts];
}
