// 约面试 (#103) in the notification list and the workspace's to-dos, for either side. Not a Server Function: it
// takes the email, so only server code that read the email from the session calls it
// (messages/server-notifications.ts, me/interview-actions.ts). Server only.
import { getAccountEmployer, getEmployer, getJob } from "@/lib/data";
import { interviewsOfBusiness, interviewsOfSeeker, interviewView } from "@/db/interviews";
import { postedAgoZh } from "@/components/seeker/format";
import {
  formatSlot,
  interviewInviteNotificationId,
  interviewReplyNotificationId,
  interviewTodo,
  whenText,
  type InterviewView,
} from "@/components/seeker/interviews";
import type { Notification } from "@/components/seeker/hub-state";

type Item = { interview: InterviewView; id: string; jobId: string; who: string; job: string };
type Identity = { email: string; isEmployer: boolean };

/** The job seeker's interviews; `who` is the business and the job. */
async function seekerItems(email: string): Promise<Item[]> {
  return Promise.all(
    (await interviewsOfSeeker(email)).map(async ({ interview, application }) => {
      const job = await getJob(application.jobId);
      const employer = job && (await getEmployer(job.employerId));
      const title = job?.titleZh ?? "职位";
      return {
        interview: interviewView(interview),
        id: interview.id,
        jobId: application.jobId,
        who: `${employer?.name ?? ""}「${title}」`,
        job: title,
      };
    }),
  );
}

/** The business's interviews; `who` is the applicant's name. */
async function employerItems(email: string): Promise<Item[]> {
  const employer = await getAccountEmployer(email);
  if (!employer) return [];
  return Promise.all(
    (await interviewsOfBusiness(employer.id)).map(async ({ interview, application }) => ({
      interview: interviewView(interview),
      id: interview.id,
      jobId: application.jobId,
      who: application.profile.name,
      job: (await getJob(application.jobId))?.titleZh ?? "职位",
    })),
  );
}

/**
 * The job seeker hears of each invitation and each change the employer makes (new times, cancelling); the employer
 * of each answer. Ids carry the time of the change, so a new one shows as unread again.
 */
export async function interviewNotifications(identity: Identity, now: number): Promise<Notification[]> {
  if (!identity.isEmployer)
    return (await seekerItems(identity.email)).map(({ interview, id, who }) => ({
      id: interviewInviteNotificationId(id, interview.invitedAt),
      type: "面试",
      title: interview.status === "cancelled" ? `${who}的面试取消了` : `${who}邀请你面试`,
      detail: interview.status === "cancelled" ? "雇主取消了这次面试" : whenText(interview),
      time: postedAgoZh(interview.invitedAt, now),
      unread: true,
      target: { type: "applications" },
    }));
  return (await employerItems(identity.email)).flatMap(({ interview, id, jobId, who, job }): Notification[] => {
    if (!interview.respondedAt || interview.status === "proposed" || interview.status === "cancelled") return [];
    const title =
      interview.status === "confirmed"
        ? `${who}确认了「${job}」的面试`
        : interview.status === "declined"
          ? `${who}婉拒了「${job}」的面试`
          : `${who}回了方便的面试时间`;
    const detail =
      interview.status === "confirmed"
        ? interview.chosenSlot
          ? formatSlot(interview.chosenSlot)
          : "等你打电话约时间"
        : interview.reply || "没有留言";
    return [
      {
        id: interviewReplyNotificationId(id, interview.respondedAt),
        type: "面试",
        title,
        detail,
        time: postedAgoZh(interview.respondedAt, now),
        unread: true,
        target: { type: "applicants", jobId },
      },
    ];
  });
}

export type InterviewTodo = { id: string; title: string; detail: string; href: string };

/** 待确认的面试 and 今天 / 明天的面试 for the workspace. */
export async function interviewTodos(identity: Identity, now: number): Promise<InterviewTodo[]> {
  const side = identity.isEmployer ? "employer" : "seeker";
  const items = identity.isEmployer ? await employerItems(identity.email) : await seekerItems(identity.email);
  return items.flatMap(({ interview, id, jobId, who }) => {
    const todo = interviewTodo(interview, side, who, now);
    if (!todo) return [];
    const href = identity.isEmployer ? `/employer/jobs/${encodeURIComponent(jobId)}/applicants` : "/me/saved";
    return [{ id: `interview:${id}`, ...todo, href }];
  });
}
