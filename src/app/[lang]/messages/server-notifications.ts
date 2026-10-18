// Every notification the server makes for an identity, in one place (#94): the job seeker's are the jobs its alerts
// found (#53, external ones #131), team invitations (#87) and how its applications ended (#105); the employer's are applications (#84), its jobs closing soon (#69) and 企业验证
// decisions (#78); either side's, interviews (#103). The notification list
// (myAlertNotifications) and the ids that may be marked read (markMyNotificationsRead) both come from here, so a new
// kind of notification cannot be shown without also being markable as read. Not a Server Function: it takes the
// email, so only server code that read the email from the session calls it. Server only.
import { getEmployer, getJob } from "@/lib/data";
import { isOpenJob } from "@/lib/job-expiry";
import { listJobAlertHits } from "@/db/job-alerts";
import { myApplicationNotifications } from "@/app/[lang]/employer/application-notifications";
import { myClosingNotifications } from "@/app/[lang]/employer/closing-notifications";
import { interviewNotifications } from "@/app/[lang]/me/interview-notifications";
import { applicationOutcomeNotifications } from "@/app/[lang]/me/application-notifications";
import { externalAlertNotifications } from "@/app/[lang]/me/external-alert-notifications";
import { myVerificationNotifications } from "@/app/[lang]/employer/verification-notifications";
import { myTeamInviteNotifications } from "@/app/[lang]/employer/team-notifications";
import { postedAgoZh } from "@/components/seeker/format";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { chatMessages } from "@/i18n/messages/chat";
import { alertNotificationId } from "@/components/seeker/job-alerts";
import type { Notification } from "@/components/seeker/hub-state";

export async function serverNotifications(
  identity: { email: string; isEmployer: boolean },
  now: number,
  lang: Lang = DEFAULT_LANG,
): Promise<Notification[]> {
  const interviews = await interviewNotifications(identity, now);
  if (identity.isEmployer)
    return [
      ...interviews,
      ...(await myApplicationNotifications(identity.email, now, lang)),
      ...(await myClosingNotifications(identity.email, now, lang)),
      ...(await myVerificationNotifications(identity.email, now, lang)),
    ];
  const t = pick(chatMessages, lang).notifications;
  const alerts = await Promise.all(
    (await listJobAlertHits(identity.email)).map(async (hit): Promise<Notification> => {
      const job = await getJob(hit.jobId);
      const employer = job && (await getEmployer(job.employerId));
      return {
        id: alertNotificationId(hit.jobId),
        type: t.type,
        title: t.alertTitle(hit.alertName),
        detail:
          job && isOpenJob(job, now)
            ? t.hiring(employer?.name ?? "", job.titleZh)
            : t.noLongerHiring(job?.titleZh ?? t.thisJob),
        time: postedAgoZh(hit.createdAt, now),
        unread: true,
        target: { type: "job", id: hit.jobId },
      };
    }),
  );
  return [
    ...interviews,
    ...(await applicationOutcomeNotifications(identity.email, now)),
    ...(await myTeamInviteNotifications(identity.email, now, lang)),
    ...alerts,
    ...(await externalAlertNotifications(identity.email, now)),
  ];
}
